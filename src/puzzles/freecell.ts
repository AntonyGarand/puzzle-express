import './freecell.css';
import { L, P } from '../core/i18n';
import type { Rng } from '../core/rng';
import { byLevel, type Difficulty, type PuzzleDef } from '../core/types';
import { btn, shake } from '../core/ui';
import { cardEl, deck, fan, pileEl, rank, slotEl, SUITS, tableEl } from './cardkit/cards';
import { autoF, bestDestF, dealF, moveF, pickedF, solveF, wonF, type FState } from './cardkit/freecell';
import { bindTable, History } from './cardkit/table';

const TAB_H = 7.5;
const TOP = 1.7;

/** Lift low cards toward the exposed end of their cascades (easier deals). */
function easeDeal(s: FState, rng: Rng, maxRank: number, depth: number) {
  for (const col of s.cas) {
    for (let i = 0; i < col.length; i++) {
      const r = rank(col[i]);
      if (r > maxRank) continue;
      const fromTop = col.length - 1 - i;
      if (fromTop < depth) continue;
      // swap with a non-low card near the top
      const j = col.length - 1 - rng.int(0, depth - 1);
      if (rank(col[j]) <= maxRank) continue;
      [col[i], col[j]] = [col[j], col[i]];
    }
  }
}

function generate(d: Difficulty, rng: Rng): FState {
  if (d === 5) {
    for (let t = 0; t < 3; t++) {
      const s = dealF(deck(rng), 3);
      if (solveF(s, 4000)) return s;
    }
  }
  let s = dealF(deck(rng), 4);
  const ease = (st: FState) => {
    if (d === 1) easeDeal(st, rng, 2, 2);
    else if (d === 2) easeDeal(st, rng, 1, 3);
  };
  ease(s);
  if (d <= 3) {
    for (let t = 0; t < 3 && !solveF(s, 3000); t++) {
      s = dealF(deck(rng), 4);
      ease(s);
    }
  }
  return s;
}

function validState(v: unknown): v is FState {
  const s = v as FState;
  if (!s || !Array.isArray(s.cells) || !Array.isArray(s.found) || !Array.isArray(s.cas) || s.cas.length !== 8 || s.found.length !== 4)
    return false;
  if (!s.cas.every(Array.isArray) || typeof s.moves !== 'number') return false;
  const n = s.cells.filter((c) => c >= 0).length + s.found.reduce((a, b) => a + b, 0) + s.cas.reduce((a, c) => a + c.length, 0);
  return n === 52;
}

export const freecell: PuzzleDef = {
  id: 'freecell',
  get name() {
    return L('FreeCell', 'FreeCell');
  },
  category: 'cards',
  get rules() {
    return L('Use free cells to sort every suit home, A→K.', 'Rangez chaque sorte de A à R grâce aux cellules libres.');
  },
  help: () => ({
    goal: L(
      'All 52 cards are dealt face up. Move them all to the four foundations at the top right, one suit per pile, from ace up to king.',
      'Les 52 cartes sont distribuées face visible. Placez-les toutes sur les quatre fondations en haut à droite, une sorte par pile, de l’as jusqu’au roi.',
    ),
    steps: [
      L(
        'In the eight columns, stack cards in descending order with alternating colours (a red 9 on a black 10). Any card can go in an empty column.',
        'Dans les huit colonnes, empilez les cartes en ordre décroissant en alternant les couleurs (un 9 rouge sur un 10 noir). N’importe quelle carte peut aller dans une colonne vide.',
      ),
      L(
        'The free cells at the top left each hold one card. There are 4, or only 3 on Master.',
        'Les cellules libres en haut à gauche contiennent une carte chacune. Il y en a 4, ou seulement 3 en Maître.',
      ),
      L(
        'Tap a card to play it automatically: to a foundation, onto a matching column, into a free cell, then into an empty column. Or drag it where you want (on a touch screen, hold it a moment first).',
        'Touchez une carte pour la jouer automatiquement : sur une fondation, sur une colonne compatible, dans une cellule libre, puis dans une colonne vide. Ou glissez-la où vous voulez (sur écran tactile, maintenez-la un instant d’abord).',
      ),
      L(
        'You can move an ordered run at once if there is enough room: free cells + 1, doubled for each empty column.',
        'Vous pouvez déplacer une suite ordonnée d’un coup s’il y a assez de place : cellules libres + 1, doublé par colonne vide.',
      ),
      L(
        'Cards that are no longer needed go home on their own. Undo takes back a move (Z or Backspace on a keyboard).',
        'Les cartes devenues inutiles se rangent toutes seules. Annuler reprend un coup (Z ou Retour arrière au clavier).',
      ),
    ],
    tips: [
      L('Free the aces and twos buried deep in the columns first.', 'Dégagez d’abord les as et les 2 enfouis dans les colonnes.'),
      L(
        'Keep free cells empty as long as you can; an empty column is worth even more.',
        'Gardez les cellules libres vides le plus longtemps possible; une colonne vide vaut encore plus.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [200, 260, 330, 420, 520]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    let s = generate(d, rng);
    autoF(s);
    const hist = new History<FState>(80);
    const sv = ctx.saved as { s?: unknown; hist?: unknown } | undefined;
    if (sv && validState(sv.s) && sv.s.cells.length === s.cells.length) {
      s = sv.s;
      hist.restore(sv.hist);
    }
    const nc = s.cells.length;
    const table = tableEl(8, TOP + TAB_H);
    let over = false;

    const status = () => {
      const home = s.found.reduce((a, b) => a + b, 0);
      ctx.status(
        `${L('Home', 'Fondations')} ${home}/52 · ${L('Moves', 'Coups')} ${s.moves}${nc < 4 ? ` · ${P(nc, ['cell', 'cells'], ['cellule', 'cellules'])}` : ''}`,
      );
    };

    const render = () => {
      const kids: HTMLElement[] = [];
      for (let k = 0; k < nc; k++) {
        const cp = pileEl('c' + k, k, 0, 1.4, 'freecell');
        cp.append(slotEl('c' + k));
        if (s.cells[k] >= 0) cp.append(cardEl(s.cells[k], true, 'c' + k, 0));
        kids.push(cp);
      }
      for (let su = 0; su < 4; su++) {
        const fp = pileEl('f' + su, 4 + su, 0);
        fp.append(slotEl('f' + su, SUITS[su]));
        if (s.found[su]) fp.append(cardEl(su * 13 + s.found[su] - 1, true, 'f' + su, 0, '', 'lock'));
        kids.push(fp);
      }
      s.cas.forEach((col, k) => {
        const tp = pileEl('t' + k, k, TOP, TAB_H);
        tp.append(slotEl('t' + k));
        const ys = fan(0, col.length, TAB_H);
        col.forEach((c, i) => tp.append(cardEl(c, true, 't' + k, i, `--y:${ys[i]}`)));
        kids.push(tp);
      });
      table.replaceChildren(...kids);
    };

    const hasMove = () => {
      for (let k = 0; k < nc; k++) if (s.cells[k] >= 0 && bestDestF(s, 'c' + k, 0)) return true;
      if (s.cells.includes(-1) && s.cas.some((c) => c.length)) return true;
      for (let a = 0; a < 8; a++) {
        const col = s.cas[a];
        for (let i = 0; i < col.length; i++) if (pickedF(s, 't' + a, i) && bestDestF(s, 't' + a, i)) return true;
      }
      return false;
    };

    const after = () => {
      autoF(s);
      render();
      if (wonF(s)) {
        over = true;
        ctx.status(L(`All home in ${s.moves} moves`, `Tout est rangé en ${P(s.moves, ['coup', 'coups'], ['coup', 'coups'])}`));
        ctx.solved();
        return;
      }
      if (!hasMove()) {
        over = true;
        ctx.status(L('No moves left', 'Aucun coup possible'));
        ctx.failed();
        return;
      }
      status();
    };

    const bump = (p: string, i: number) => {
      const el = table.querySelector(`[data-p="${p}"][data-i="${i}"]`);
      if (el) shake(el);
    };

    bindTable(table, {
      canDrag: (p, i) => !over && pickedF(s, p, i) != null,
      accepts: (p, i, to) => moveF(s, p, i, to[0] === 'f' ? 'f' : to, true) || (to[0] === 't' && (pickedF(s, p, i)?.length ?? 0) > 1),
      tap(p, i) {
        if (over || i < 0) return;
        ctx.touch();
        const to = bestDestF(s, p, i);
        if (!to) {
          bump(p, i);
          return;
        }
        hist.push(s);
        moveF(s, p, i, to);
        after();
      },
      drop(p, i, to) {
        if (over) return false;
        ctx.touch();
        const dest = to[0] === 'f' ? 'f' : to;
        if (!moveF(s, p, i, dest, true)) {
          const n = pickedF(s, p, i)?.length ?? 0;
          if (n > 1 && to[0] === 't')
            ctx.status(L(`Not enough free space to move ${n} cards`, `Pas assez d’espace libre pour déplacer ${n} cartes`));
          return false;
        }
        hist.push(s);
        moveF(s, p, i, dest);
        after();
        return true;
      },
    });

    const undo = () => {
      if (over) return;
      const prev = hist.pop();
      if (!prev) return;
      ctx.touch();
      s = prev;
      render();
      status();
    };
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'));
    root.append(table);
    render();
    status();

    return {
      snapshot: () => ({ s, hist: hist.stack }),
      onKey(e) {
        if (e.key === 'z' || e.key === 'Backspace') {
          undo();
          return true;
        }
        return false;
      },
    };
  },
};
