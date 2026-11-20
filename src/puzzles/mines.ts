import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, btn, h } from '../core/ui';
import { nb8 } from './logickit/kit';
import { flood, genMines, mineCounts } from './logickit/minesgen';
import './mines.css';

export const mines: PuzzleDef = {
  id: 'mines',
  get name() {
    return L('Mines', 'Démineur');
  },
  category: 'logic',
  get rules() {
    return L('Open every safe tile. Numbers count mines around.', 'Ouvrez toutes les cases sûres. Un chiffre = mines autour.');
  },
  help: () => ({
    goal: L(
      'Open every tile that doesn’t hide a mine. Numbers tell you how many mines touch each tile.',
      'Ouvrez toutes les cases qui ne cachent pas de mine. Les chiffres indiquent combien de mines touchent chaque case.',
    ),
    steps: [
      L(
        'Tap a tile to open it. Your first tap is always safe.',
        'Touchez une case pour l’ouvrir. Votre première case est toujours sans danger.',
      ),
      L(
        'A number counts the mines in the 8 tiles around it. Opening a mine ends the game.',
        'Un chiffre compte les mines dans les 8 cases autour. Ouvrir une mine met fin à la partie.',
      ),
      L(
        'Long-press or right-click a tile to flag it, or switch the footer button to “Tap: flag” (F or Space).',
        'Appuyez longuement ou cliquez droit pour poser un drapeau. Ou réglez le bouton du bas sur « Touche : drapeau » (F ou Espace).',
      ),
      L(
        'Tap an open number whose mines are all flagged to open the rest of its neighbours at once.',
        'Touchez un chiffre ouvert dont toutes les mines sont marquées pour ouvrir ses autres voisines d’un coup.',
      ),
    ],
    tips: [
      L(
        'If a number has as many closed neighbours as its value, they are all mines.',
        'Si un chiffre a autant de voisines fermées que sa valeur, ce sont toutes des mines.',
      ),
      L(
        'If a number already has all its flags, its other neighbours are safe. No guessing is ever needed.',
        'Si un chiffre a déjà tous ses drapeaux, ses autres voisines sont sûres. Vous n’avez jamais à deviner.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [30, 60, 100, 160, 240]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const cols = byLevel(d, [8, 9, 9, 10, 10]);
    const rows = byLevel(d, [8, 9, 11, 12, 13]);
    const total = byLevel(d, [9, 13, 18, 23, 28]);
    const N = cols * rows;

    // Mines are generated lazily on the first dig, from the untouched rng, so resume can rebuild them.
    let first = -1;
    let mine: boolean[] = new Array<boolean>(N).fill(false);
    let count: number[] = new Array<number>(N).fill(0);
    const open = new Array<boolean>(N).fill(false);
    const flag = new Array<boolean>(N).fill(false);
    let mode: 'dig' | 'flag' = 'dig';
    let over: 'won' | 'lost' | null = null;
    let hit = -1;

    const grid = board(cols, rows, 'lk-mines');
    const cells = Array.from({ length: N }, (_, i) => {
      const el = h('button', { type: 'button', class: 'cell', 'data-i': i, onclick: () => tap(i) });
      grid.append(el);
      return el;
    });

    const lay = (i: number) => {
      first = i;
      mine = genMines(cols, rows, total, i, rng);
      count = mineCounts(mine, cols, rows);
    };

    const render = () => {
      cells.forEach((el, i) => {
        const cls = ['cell'];
        let txt = '';
        if (open[i]) {
          cls.push('open');
          if (count[i]) {
            cls.push(`m${count[i]}`);
            txt = String(count[i]);
          }
        } else if (over === 'lost' && mine[i]) {
          cls.push('mine');
          if (i === hit) cls.push('err');
        } else if (flag[i]) {
          cls.push(over === 'lost' && !mine[i] ? 'x' : 'flag');
        }
        el.className = cls.join(' ');
        if (el.textContent !== txt) el.textContent = txt;
      });
      const flags = flag.filter(Boolean).length;
      ctx.status(
        first < 0
          ? L(`${total} mines · tap any tile`, `${total} mines à trouver`)
          : P(total - flags, ['mine left', 'mines left'], ['mine restante', 'mines restantes']),
      );
    };

    const won = () => open.filter(Boolean).length === N - total;

    const boom = (i: number) => {
      over = 'lost';
      hit = i;
      render();
      ctx.failed();
    };

    const dig = (i: number) => {
      if (flag[i]) return;
      if (first < 0) lay(i);
      if (open[i]) {
        // Chord: open the rest once enough flags surround a number.
        const nb = nb8(i, cols, rows);
        if (!count[i] || nb.filter((j) => flag[j]).length !== count[i]) return;
        const bad = nb.find((j) => !flag[j] && !open[j] && mine[j]);
        if (bad != null) return boom(bad);
        for (const j of nb) if (!flag[j]) flood(j, open, mine, count, cols, rows);
      } else if (mine[i]) {
        return boom(i);
      } else {
        flood(i, open, mine, count, cols, rows);
      }
      for (let k = 0; k < N; k++) if (open[k]) flag[k] = false;
      if (won()) {
        over = 'won';
        mine.forEach((m, k) => (flag[k] = m));
        render();
        ctx.solved();
        return;
      }
      render();
    };

    const toggleFlag = (i: number) => {
      if (over || open[i]) return;
      ctx.touch();
      flag[i] = !flag[i];
      render();
    };

    // Long-press / right-click flags.
    let pressTimer = 0,
      pressCell = -1,
      px = 0,
      py = 0,
      suppress = false;
    const cellOf = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.('[data-i]') as HTMLElement | null;
      return t && grid.contains(t) ? Number(t.dataset.i) : -1;
    };
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = 0;
    };
    grid.addEventListener('pointerdown', (e) => {
      suppress = false;
      cancelPress();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pressCell = cellOf(e);
      px = e.clientX;
      py = e.clientY;
      if (pressCell < 0) return;
      pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        if (over || open[pressCell]) return;
        suppress = true;
        toggleFlag(pressCell);
        navigator.vibrate?.(12);
      }, 380);
    });
    grid.addEventListener('pointermove', (e) => {
      if (pressTimer && Math.hypot(e.clientX - px, e.clientY - py) > 10) cancelPress();
    });
    grid.addEventListener('pointerup', cancelPress);
    grid.addEventListener('pointercancel', cancelPress);
    grid.addEventListener('pointerleave', cancelPress);
    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      cancelPress();
      if (suppress) return;
      const i = cellOf(e);
      if (i >= 0) toggleFlag(i);
    });

    const tap = (i: number) => {
      if (suppress) {
        suppress = false;
        return;
      }
      if (over) return;
      ctx.touch();
      if (mode === 'flag' && !open[i]) toggleFlag(i);
      else dig(i);
    };

    const digLabel = L('Tap: dig', 'Touche : creuser'),
      flagLabel = L('Tap: flag', 'Touche : drapeau');
    const modeBtn = btn(
      digLabel,
      () => {
        mode = mode === 'dig' ? 'flag' : 'dig';
        modeBtn.textContent = mode === 'dig' ? digLabel : flagLabel;
      },
      'ghost',
    );
    ctx.controls(modeBtn);

    const sv = ctx.saved as { first?: unknown; open?: unknown; flag?: unknown; mode?: unknown } | undefined;
    if (sv && typeof sv.first === 'number' && Number.isInteger(sv.first) && sv.first >= 0 && sv.first < N) {
      lay(sv.first);
      const idx = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is number => Number.isInteger(k) && k >= 0 && k < N) : []);
      for (const k of idx(sv.open)) if (!mine[k]) open[k] = true;
      for (const k of idx(sv.flag)) if (!open[k]) flag[k] = true;
    }
    if (sv?.mode === 'flag') modeBtn.click();
    root.append(grid);
    render();

    const list = (a: boolean[]) => a.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    return {
      snapshot: () => ({ first, open: list(open), flag: list(flag), mode }),
      onKey(e) {
        if (e.key === 'f' || e.key === ' ') {
          modeBtn.click();
          return true;
        }
        return false;
      },
      destroy: cancelPress,
    };
  },
};
