import './freecell.css';
import { L, P } from '../core/i18n';
import { byLevel, type Hint, type PuzzleDef } from '../core/types';
import { btn, shake } from '../core/ui';
import { cap, cardEl, elAt, fan, isRed, label, leCard, pileEl, rank, slotEl, suit, SUITS, tableEl, topEl } from './cardkit/cards';
import { autoF, bestDestF, genF, moveF, pickedF, solveF, wonF, type FState } from './cardkit/freecell';
import { bindTable, History } from './cardkit/table';

const TAB_H = 7.5;
const TOP = 1.7;

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
    let s = genF(d, rng);
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

    /** Proven unwinnable from here, though moves remain (undo can still save it). */
    let doomed = false;
    const judge = () => {
      doomed = solveF(s, 1500, true) === 'dead';
    };

    const status = () => {
      const home = s.found.reduce((a, b) => a + b, 0);
      if (doomed) {
        ctx.status(
          `${L('Home', 'Fondations')} ${home}/52 · ${L('No way to win from here · Undo or skip', 'Impossible de gagner d’ici · Annulez ou passez')}`,
        );
        return;
      }
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
      judge();
      status();
    };

    const bump = (p: string, i: number) => {
      const el = table.querySelector(`[data-p="${p}"][data-i="${i}"]`);
      if (el) shake(el);
    };

    /** Apply a validated move (tap, drop and the guide all come through here). */
    const go = (p: string, i: number, to: string) => {
      hist.push(s);
      moveF(s, p, i, to);
      after();
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
        go(p, i, to);
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
        go(p, i, dest);
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
      judge();
      status();
    };
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'));
    root.append(table);
    render();
    if (sv) judge();
    status();

    let lastRule = '';
    const hint = (): Hint | null => {
      if (over) return null;
      const el = (p: string, i: number) => elAt(table, p, i)!;
      const topOf = (t: number) => s.cas[t][s.cas[t].length - 1];
      const cands: { rule: string; h: Hint }[] = [];
      // Home: a card that fits its foundation (the safe ones already went up on their own).
      const home = (p: string, i: number, c: number) =>
        cands.push({
          rule: 'home',
          h: {
            text:
              rank(c) === 1
                ? L(
                    `The ${label(c)} starts its foundation. Each suit builds up there from ace to king.`,
                    `${cap(leCard(c))} commence sa fondation. Chaque sorte s’y empile de l’as au roi.`,
                  )
                : L(
                    `The ${label(c)} goes home on the ${label(c - 1)}: foundations build up by suit.`,
                    `${cap(leCard(c))} monte sur ${leCard(c - 1)} : les fondations montent par sorte.`,
                  ),
            why: [el(p, i)],
            at: [topEl(table, 'f' + suit(c))!],
            play: () => go(p, i, 'f'),
          },
        });
      for (let k = 0; k < nc; k++) if (s.cells[k] >= 0 && moveF(s, 'c' + k, 0, 'f', true)) home('c' + k, 0, s.cells[k]);
      s.cas.forEach((col, a) => {
        if (col.length && moveF(s, 't' + a, col.length - 1, 'f', true)) home('t' + a, col.length - 1, col[col.length - 1]);
      });
      // Dig: uncover the next card a foundation needs, shallowest first.
      const needs: { a: number; j: number; c: number }[] = [];
      for (let su = 0; su < 4; su++) {
        if (s.found[su] === 13) continue;
        const c = su * 13 + s.found[su];
        s.cas.forEach((col, a) => {
          const j = col.indexOf(c);
          if (j >= 0 && j < col.length - 1) needs.push({ a, j, c });
        });
      }
      needs.sort((x, y) => s.cas[x.a].length - x.j - (s.cas[y.a].length - y.j) || rank(x.c) - rank(y.c));
      // First try stacking what covers a needed card elsewhere; park in a cell only as a last resort.
      dig: for (const { a, j, c } of needs) {
        const col = s.cas[a];
        const p = 't' + a;
        for (let i = j + 1; i < col.length; i++) {
          if (!pickedF(s, p, i)) continue;
          for (let t = 0; t < 8; t++) {
            if (t === a || !s.cas[t].length || !moveF(s, p, i, 't' + t, true)) continue;
            const n = col.length - i;
            const dst = topOf(t);
            cands.push({
              rule: n === 1 ? 'dig' : 'run',
              h: {
                text:
                  n === 1
                    ? L(
                        `Dig toward the ${label(c)}: the ${label(col[i])} fits on the ${label(dst)}, one lower and ${isRed(dst) ? 'black on red' : 'red on black'}.`,
                        `Dégagez ${leCard(c)} : ${leCard(col[i])} va sur ${leCard(dst)}, une valeur de moins et ${isRed(dst) ? 'noir sur rouge' : 'rouge sur noir'}.`,
                      )
                    : L(
                        `Dig toward the ${label(c)}: move these ${n} cards onto the ${label(dst)} at once. Free cells and empty columns let runs move together.`,
                        `Dégagez ${leCard(c)} : déplacez ces ${n} cartes d’un coup sur ${leCard(dst)}. Les cellules et colonnes libres permettent de bouger une suite entière.`,
                      ),
                why: [el(p, j), el(p, i)],
                at: [el('t' + t, s.cas[t].length - 1)],
                play: () => go(p, i, 't' + t),
              },
            });
            break dig;
          }
        }
      }
      // Nothing to stack on: park a lone card in a free cell, if that soon frees the needed card.
      const freeN = s.cells.filter((c) => c < 0).length;
      if (!cands.some((x) => x.rule === 'dig' || x.rule === 'run'))
        for (const { a, j, c } of needs) {
          const col = s.cas[a];
          const p = 't' + a;
          const top = col[col.length - 1];
          const free = s.cells.indexOf(-1);
          if (free < 0 || col.length - 1 - j > freeN || pickedF(s, p, col.length - 2) != null) continue;
          cands.push({
            rule: 'cell',
            h: {
              text: L(
                `The ${label(top)} has nowhere to go and covers the ${label(c)}. Park it in a free cell: each cell holds one card.`,
                `${cap(leCard(top))} n’a pas de place et couvre ${leCard(c)}. Rangez-le dans une cellule libre : une carte par cellule.`,
              ),
              why: [el(p, j), el(p, col.length - 1)],
              at: [el('c' + free, -1)],
              play: () => go(p, col.length - 1, 'c'),
            },
          });
          break;
        }
      // Back: bring a parked card down from its cell so the cell is free again.
      back: for (let k = 0; k < nc; k++) {
        const c = s.cells[k];
        if (c < 0) continue;
        for (let t = 0; t < 8; t++) {
          if (!s.cas[t].length || !moveF(s, 'c' + k, 0, 't' + t, true)) continue;
          const dst = topOf(t);
          cands.push({
            rule: 'back',
            h: {
              text: L(
                `The ${label(c)} can leave its cell for the ${label(dst)}: one lower, opposite colour. Free cells are precious; empty them when you can.`,
                `${cap(leCard(c))} peut quitter sa cellule pour ${leCard(dst)} : une valeur de moins, couleur opposée. Videz les cellules dès que possible.`,
              ),
              why: [el('c' + k, 0)],
              at: [el('t' + t, s.cas[t].length - 1)],
              play: () => go('c' + k, 0, 't' + t),
            },
          });
          break back;
        }
      }
      // Fallback: what a tap would do with some exposed card.
      for (let a = 0; a < 8 && !cands.length; a++) {
        const col = s.cas[a];
        if (!col.length) continue;
        const i = col.length - 1;
        const to = bestDestF(s, 't' + a, i);
        if (!to || to[0] !== 't') continue;
        const n = Number(to.slice(1));
        const dst = s.cas[n].length ? topOf(n) : -1;
        cands.push({
          rule: 'any',
          h: {
            text:
              dst >= 0
                ? L(
                    `Stack the ${label(col[i])} on the ${label(dst)}: one lower, opposite colour.`,
                    `Empilez ${leCard(col[i])} sur ${leCard(dst)} : une valeur de moins, couleur opposée.`,
                  )
                : L(
                    `An empty column takes any card: move the ${label(col[i])} there.`,
                    `Une colonne vide accepte n’importe quelle carte : déplacez-y ${leCard(col[i])}.`,
                  ),
            why: [el('t' + a, i)],
            at: [topEl(table, to)!],
            play: () => go('t' + a, i, to),
          },
        });
      }
      if (!cands.length) return null;
      const pick = cands.find((x) => x.rule !== lastRule) ?? cands[0];
      lastRule = pick.rule;
      return pick.h;
    };

    return {
      hint,
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
