import { L, P } from '../core/i18n';
import { byLevel, type Hint, type PuzzleDef } from '../core/types';
import { board, btn, h, pad, shake } from '../core/ui';
import { anim, keyDir, onSwipe, type Dir } from './movekit/kit';
import { solvePush } from './movekit/push-hint';
import { generateRoom, stepper } from './movekit/pushgen';
import './push.css';

const LETTERS = 'urdl';

export const push: PuzzleDef = {
  id: 'push',
  get name() {
    return L('Push', 'Pousser');
  },
  category: 'moves',
  get rules() {
    return L('Push every crate onto a target. You can only push.', 'Poussez les caisses sur les cibles. Impossible de tirer.');
  },
  help: () => ({
    goal: L('Push every crate onto a target square.', 'Poussez chaque caisse sur une case cible.'),
    steps: [
      L(
        'Move by swiping on the board, with the arrow buttons, or with the arrow keys / WASD.',
        'Déplacez-vous en balayant le plateau, avec les flèches à l’écran ou les touches fléchées / WASD.',
      ),
      L(
        'Walk into a crate to push it one square, if the square behind it is free.',
        'Avancez contre une caisse pour la pousser d’une case, si la case derrière est libre.',
      ),
      L('You can’t pull a crate, and you can’t push two at once.', 'Impossible de tirer une caisse ou d’en pousser deux à la fois.'),
      L(
        'Tap a square to walk there, or tap a crate next to you to push it.',
        'Touchez une case pour vous y rendre, ou une caisse voisine pour la pousser.',
      ),
      L('Undo (Z) takes back an action; Restart (R) resets the room.', 'Annuler (Z) reprend une action; Repartir (R) remet tout à zéro.'),
    ],
    tips: [
      L(
        'Never push a crate into a corner that isn’t a target: it’s stuck for good.',
        'Ne poussez jamais une caisse dans un coin sans cible : elle y restera coincée.',
      ),
      L(
        'Before each push, check where you’ll need to stand for the next one.',
        'Avant chaque poussée, vérifiez où vous devrez vous placer pour la suivante.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [25, 50, 90, 140, 220]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const [w, hh] = byLevel<[number, number]>(d, [
      [6, 6],
      [7, 6],
      [7, 7],
      [8, 7],
      [8, 8],
    ]);
    const nBoxes = byLevel(d, [1, 2, 3, 3, 4]);
    const minPush = byLevel(d, [5, 9, 12, 14, 16]);
    const room = generateRoom(rng, w, hh, nBoxes, minPush, 20000, nBoxes >= 3 ? 150 : 300);
    const { floor, targets } = room;
    const nb = stepper(w, hh);
    const tset = new Set(targets);

    let player = room.player;
    let boxes = room.boxes.slice();
    /** One string per action (a tap-walk can be several steps); lowercase = walk, uppercase = push. */
    let history: string[] = [];
    let done = false;

    /** Apply one step; returns the letter recorded, or '' if blocked. */
    const step = (dir: Dir): string => {
      const nx = nb(player, dir);
      if (nx < 0 || !floor[nx]) return '';
      const bi = boxes.indexOf(nx);
      if (bi >= 0) {
        const to = nb(nx, dir);
        if (to < 0 || !floor[to] || boxes.includes(to)) return '';
        boxes[bi] = to;
        player = nx;
        return LETTERS[dir].toUpperCase();
      }
      player = nx;
      return LETTERS[dir];
    };
    const unstep = (ch: string) => {
      const dir = LETTERS.indexOf(ch.toLowerCase());
      const back = nb(player, (dir + 2) % 4);
      if (ch !== ch.toLowerCase()) {
        const bi = boxes.indexOf(nb(player, dir));
        if (bi >= 0) boxes[bi] = player;
      }
      player = back;
    };
    const restart = () => {
      player = room.player;
      boxes = room.boxes.slice();
    };

    // Restore by replaying the saved actions (stops at the first one that no longer applies).
    const sv = ctx.saved as { h?: unknown } | undefined;
    if (Array.isArray(sv?.h)) {
      outer: for (const a of sv.h) {
        if (typeof a !== 'string' || !a) break;
        for (const ch of a) {
          const dir = LETTERS.indexOf(ch.toLowerCase());
          if (dir < 0 || step(dir as Dir) !== ch) {
            restart();
            history = [];
            break outer;
          }
        }
        history.push(a);
      }
    }

    // Crop to the floor's bounding box.
    let r0 = hh,
      r1 = 0,
      c0 = w,
      c1 = 0;
    floor.forEach((f, i) => {
      if (!f) return;
      const r = Math.floor(i / w),
        c = i % w;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
    });
    const cols = c1 - c0 + 1,
      rows = r1 - r0 + 1;
    const grid = board(cols, rows, 'push-grid');
    const els = new Map<number, HTMLElement>();
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * w + c;
        const el = floor[i] ? h('button', { type: 'button', class: 'cell', onclick: () => tap(i) }) : h('div', { class: 'cell wall' });
        els.set(i, el);
        grid.append(el);
      }

    const solved = () => boxes.every((b) => tset.has(b));
    const render = () => {
      els.forEach((el, i) => {
        if (!floor[i]) return;
        const box = boxes.includes(i);
        el.className = `cell ${tset.has(i) ? 'tg' : ''} ${box ? 'bx' : ''} ${box && tset.has(i) ? 'on' : ''} ${i === player ? 'me' : ''}`
          .replace(/\s+/g, ' ')
          .trim();
      });
      const moves = history.reduce((a, s) => a + s.length, 0);
      const home = boxes.filter((b) => tset.has(b)).length;
      const ms = P(moves, ['move', 'moves'], ['pas', 'pas']);
      ctx.status(L(`${home}/${boxes.length} home · ${ms}`, `${home}/${boxes.length} · ${ms}`));
    };
    const after = (rec: string) => {
      if (!rec) return;
      ctx.touch();
      history.push(rec);
      render();
      const pushed = rec[rec.length - 1];
      if (pushed !== pushed.toLowerCase()) {
        const b = els.get(nb(player, LETTERS.indexOf(pushed.toLowerCase())));
        if (b) anim(b, [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], 120);
      }
      if (solved()) {
        done = true;
        ctx.solved();
      }
    };
    const move = (dir: Dir) => {
      if (done) return;
      const rec = step(dir);
      if (!rec) {
        shake(grid);
        return;
      }
      after(rec);
    };
    /** Tap: adjacent cell = one step (push if a crate), otherwise walk there if reachable. */
    const tap = (i: number) => {
      if (done || swiped) {
        swiped = false;
        return;
      }
      for (let dd = 0; dd < 4; dd++)
        if (nb(player, dd) === i) {
          move(dd as Dir);
          return;
        }
      if (boxes.includes(i) || i === player) return;
      // BFS path without pushing
      const prev = new Map<number, number>([[player, -1]]);
      const q = [player];
      for (let k = 0; k < q.length && !prev.has(i); k++) {
        for (let dd = 0; dd < 4; dd++) {
          const y = nb(q[k], dd);
          if (y < 0 || !floor[y] || boxes.includes(y) || prev.has(y)) continue;
          prev.set(y, q[k]);
          q.push(y);
        }
      }
      if (!prev.has(i)) {
        shake(grid);
        return;
      }
      const path: number[] = [];
      for (let x = i; x !== player; x = prev.get(x)!) path.unshift(x);
      let rec = '';
      for (const x of path) {
        const dir = [0, 1, 2, 3].find((dd) => nb(player, dd) === x)!;
        rec += step(dir as Dir);
      }
      after(rec);
    };
    const undo = () => {
      if (done) return;
      const a = history.pop();
      if (!a) return;
      for (let k = a.length - 1; k >= 0; k--) unstep(a[k]);
      render();
    };
    const reset = () => {
      if (done || !history.length) return;
      restart();
      history = [];
      render();
    };

    /** Guide: follow a fewest-pushes solution; walking behind a crate and pushing it are separate steps. */
    const hint = (): Hint | null => {
      if (done) return null;
      const sol = solvePush(w, hh, floor, targets, boxes, player);
      if (!sol?.length) return null;
      const { box, dir } = sol[0];
      const el = (i: number) => els.get(i)!;
      const dirName = [L('up', 'vers le haut'), L('right', 'vers la droite'), L('down', 'vers le bas'), L('left', 'vers la gauche')][dir];
      const behind = nb(box, (dir + 2) % 4);
      if (player !== behind) {
        const side = [
          L('below it', 'sous elle'),
          L('on its left', 'à sa gauche'),
          L('above it', 'au-dessus d’elle'),
          L('on its right', 'à sa droite'),
        ][dir];
        return {
          text: L(
            `You can only push, never pull. To push this crate ${dirName}, first stand ${side}: tap that square to walk there.`,
            `On peut seulement pousser, jamais tirer. Pour pousser cette caisse ${dirName}, placez-vous d’abord ${side} : touchez cette case pour y aller.`,
          ),
          why: [el(box)],
          at: [el(behind)],
          play: () => tap(behind),
        };
      }
      let k = 1,
        end = nb(box, dir);
      while (k < sol.length && sol[k].box === end && sol[k].dir === dir) {
        k++;
        end = nb(end, dir);
      }
      const sq = k === 1 ? L('one square', 'd’une case') : L(`${k} squares`, `de ${k} cases`);
      const row = (i: number) => Math.floor(i / w),
        col = (i: number) => i % w;
      const free = targets.filter((t) => !boxes.includes(t));
      const lined = free.some((t) => (row(t) === row(end) || col(t) === col(end)) && row(t) !== row(box) && col(t) !== col(box));
      const text = tset.has(end)
        ? L(`Push the crate ${sq} ${dirName}, right onto the target.`, `Poussez la caisse ${sq} ${dirName}, jusque sur la cible.`)
        : lined
          ? L(
              `Push the crate ${sq} ${dirName}: now it lines up with a target, so straight pushes can bring it home.`,
              `Poussez la caisse ${sq} ${dirName} : elle est alors alignée avec une cible, et des poussées en ligne droite l’y amèneront.`,
            )
          : L(
              `Push the crate ${sq} ${dirName}. Plan ahead: a crate pushed into a corner can never be pulled back out.`,
              `Poussez la caisse ${sq} ${dirName}. Prévoyez la suite : une caisse poussée dans un coin ne peut plus en sortir.`,
            );
      return {
        text,
        why: [el(player), el(box)],
        at: [el(end)],
        play: () => {
          for (let j = 0; j < k; j++) move(dir as Dir);
        },
      };
    };

    let swiped = false;
    grid.addEventListener('pointerdown', () => (swiped = false));
    onSwipe(grid, (dir) => {
      swiped = true;
      move(dir);
    });

    const arrows = pad(
      [
        { label: '←', value: '3' },
        { label: '↑', value: '0' },
        { label: '↓', value: '2' },
        { label: '→', value: '1' },
      ],
      (v) => move(Number(v) as Dir),
    );
    arrows.classList.add('push-pad');
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'), btn(L('Restart', 'Repartir'), reset, 'ghost'));
    root.append(grid, arrows);
    render();

    return {
      snapshot: () => ({ h: history }),
      hint,
      onKey(e) {
        const k = keyDir(e);
        if (k != null) {
          move(k);
          return true;
        }
        if (e.key === 'z' || e.key === 'Backspace' || e.key === 'u') {
          undo();
          return true;
        }
        if (e.key === 'r') {
          reset();
          return true;
        }
        return false;
      },
    };
  },
};
