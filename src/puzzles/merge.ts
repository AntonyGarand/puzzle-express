import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, shake } from '../core/ui';
import { anim, baseSeed, GROW, int, isIntArr, keyDir, onSwipe, POP, subRng, type Dir } from './movekit/kit';
import './merge.css';

/** Fill colour per exponent (2 = 2^1 …). Low values are tints so they stay readable in both themes. */
const TONES: Record<number, { c: string; lo?: boolean }> = {
  1: { c: 'color-mix(in srgb, var(--p4) 22%, var(--cell))', lo: true },
  2: { c: 'color-mix(in srgb, var(--p4) 48%, var(--cell))', lo: true },
  3: { c: 'var(--p4)' },
  4: { c: 'var(--p1)' },
  5: { c: 'var(--p7)' },
  6: { c: 'var(--p5)' },
  7: { c: 'var(--p2)' },
  8: { c: 'var(--p6)' },
  9: { c: 'var(--p3)' },
};

/** Slide a board in a direction. Pure: returns the new board, points gained and merged cell indexes. */
export function slideBoard(b: number[], n: number, dir: Dir) {
  const out = b.slice();
  const merged: number[] = [];
  let gained = 0;
  for (let line = 0; line < n; line++) {
    const idx: number[] = [];
    for (let k = 0; k < n; k++) {
      const p = dir === 0 || dir === 3 ? k : n - 1 - k;
      idx.push(dir === 0 || dir === 2 ? p * n + line : line * n + p);
    }
    const vals = idx.map((i) => b[i]).filter((v) => v);
    const res: number[] = [];
    for (let k = 0; k < vals.length; k++) {
      if (k + 1 < vals.length && vals[k] === vals[k + 1]) {
        res.push(vals[k] * 2);
        gained += vals[k] * 2;
        merged.push(idx[res.length - 1]);
        k++;
      } else res.push(vals[k]);
    }
    idx.forEach((i, k) => (out[i] = res[k] ?? 0));
  }
  const moved = out.some((v, i) => v !== b[i]);
  return { b: out, moved, gained, merged };
}

export const canMove = (b: number[], n: number) =>
  b.some((v, i) => !v || (i % n < n - 1 && b[i + 1] === v) || (i + n < n * n && b[i + n] === v));

export const merge: PuzzleDef = {
  id: 'merge',
  get name() { return L('Merge', 'Fusion'); },
  category: 'numbers',
  get rules() { return L('Slide to merge equal tiles. Reach the goal tile.', 'Glissez pour fusionner les tuiles égales. Visez l’objectif.'); },
  help: () => ({
    goal: L(
      'Slide the tiles to merge equal numbers and build the goal tile, from 64 on Easy up to 1024 on Master.',
      'Faites glisser les tuiles pour fusionner les nombres égaux et obtenir la tuile objectif, de 64 en Facile à 1024 en Maître.',
    ),
    steps: [
      L('Swipe on the board or press the arrow keys / WASD: every tile slides as far as it can that way.', 'Balayez le plateau ou utilisez les touches fléchées / WASD : toutes les tuiles glissent le plus loin possible.'),
      L('Two equal tiles that meet merge into one worth double, and the sum is added to your score.', 'Deux tuiles égales qui se rencontrent fusionnent en une seule de valeur double, ajoutée à votre pointage.'),
      L('After each move, a new 2 or 4 appears in an empty cell.', 'Après chaque coup, un 2 ou un 4 apparaît dans une case vide.'),
      L('If the board is full and nothing can merge, the game is lost.', 'Si le plateau est plein et que rien ne peut fusionner, la partie est perdue.'),
    ],
    tips: [
      L('Keep your biggest tile in a corner and build towards it.', 'Gardez votre plus grosse tuile dans un coin et construisez vers elle.'),
      L('Mostly use two or three directions; avoid the one that pulls your big tile out of its corner.', 'Jouez surtout dans deux ou trois directions; évitez celle qui sort votre grosse tuile de son coin.'),
    ],
  }),
  par: (d) => byLevel(d, [60, 120, 240, 480, 900]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [5, 4, 4, 4, 4]);
    const goal = byLevel(d, [64, 128, 256, 512, 1024]);
    const base = baseSeed(rng);
    let cells = new Array<number>(n * n).fill(0);
    let score = 0;
    let spawns = 0;
    let over = false;

    /** Spawn number k always lands on the same choice for the same board, so resumes replay exactly. */
    const spawn = (): number => {
      const empties = cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const r = subRng(base, spawns++);
      if (!empties.length) return -1;
      const at = empties[r.int(0, empties.length - 1)];
      cells[at] = r.chance(0.9) ? 2 : 4;
      return at;
    };

    const sv = ctx.saved as { cells?: unknown; score?: unknown; spawns?: unknown } | undefined;
    if (isIntArr(sv?.cells, n * n) && sv.cells.every((v) => v === 0 || (v >= 2 && (v & (v - 1)) === 0))) {
      cells = sv.cells.slice();
      score = int(sv.score, 0);
      spawns = int(sv.spawns, 2);
    } else {
      spawn();
      spawn();
    }

    const grid = board(n, n, 'merge-grid');
    const els = cells.map(() => {
      const el = h('div', { class: 'cell' });
      grid.append(el);
      return el;
    });
    const best = () => Math.max(...cells);
    const render = () => {
      cells.forEach((v, i) => {
        const el = els[i];
        if (!v) {
          el.className = 'cell';
          el.textContent = '';
          el.removeAttribute('style');
          return;
        }
        const e = Math.round(Math.log2(v));
        const t = TONES[e];
        const digits = String(v).length;
        el.className = `cell mg ${t ? (t.lo ? 'lo' : '') : 'top'} ${digits >= 3 ? `d${Math.min(digits, 5)}` : ''}`.replace(/\s+/g, ' ').trim();
        el.textContent = String(v);
        if (t) el.setAttribute('style', `--c:${t.c}`);
        else el.removeAttribute('style');
      });
      ctx.status(L(`Score ${score} · goal ${goal}`, `Pointage ${score} · objectif ${goal}`));
    };

    const move = (dir: Dir) => {
      if (over) return;
      const res = slideBoard(cells, n, dir);
      if (!res.moved) { shake(grid); return; }
      ctx.touch();
      cells = res.b;
      score += res.gained;
      const born = spawn();
      render();
      for (const i of res.merged) anim(els[i], POP, 150);
      if (born >= 0) anim(els[born], GROW, 140);
      if (best() >= goal) { over = true; ctx.solved(); }
      else if (!canMove(cells, n)) {
        over = true;
        shake(grid);
        ctx.status(L(`No moves left · score ${score}`, `Plus aucun coup · pointage ${score}`));
        ctx.failed();
      }
    };

    onSwipe(grid, move);
    root.append(grid);
    render();

    return {
      snapshot: () => ({ cells, score, spawns }),
      onKey(e) {
        const k = keyDir(e);
        if (k == null) return false;
        move(k);
        return true;
      },
    };
  },
};
