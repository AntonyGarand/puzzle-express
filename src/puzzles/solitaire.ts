import './solitaire.css';
import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import { cardEl, deck, fan, pileEl, slotEl, SUITS, tableEl } from './cardkit/cards';
import {
  bestDest,
  canDraw,
  canRedeal,
  dealK,
  draw,
  finishK,
  greedyK,
  hasProgress,
  moveK,
  picked,
  trivialK,
  wonK,
  type KRules,
  type KState,
} from './cardkit/klondike';
import { bindTable, History } from './cardkit/table';

const TAB_H = 7.6; // tableau height in card widths
const TOP = 1.7; // tableau y offset

function validState(v: unknown): v is KState {
  const s = v as KState;
  if (!s || !Array.isArray(s.stock) || !Array.isArray(s.waste) || !Array.isArray(s.found) || !Array.isArray(s.tab)) return false;
  if (s.found.length !== 4 || s.tab.length !== 7 || !s.tab.every((t) => Array.isArray(t?.d) && Array.isArray(t?.u))) return false;
  const n = s.stock.length + s.waste.length + s.found.reduce((a, b) => a + b, 0) + s.tab.reduce((a, t) => a + t.d.length + t.u.length, 0);
  return n === 52 && typeof s.redeals === 'number' && typeof s.moves === 'number';
}

export const solitaire: PuzzleDef = {
  id: 'solitaire',
  get name() {
    return L('Solitaire', 'Solitaire');
  },
  category: 'cards',
  get rules() {
    return L('Build suits A→K. Stack down in alternating colours.', 'Montez les sortes de A à R; alternez les couleurs.');
  },
  help: () => ({
    goal: L(
      'Move all 52 cards to the four foundations at the top right, one suit per pile, from ace up to king.',
      'Placez les 52 cartes sur les quatre fondations en haut à droite, une sorte par pile, de l’as jusqu’au roi.',
    ),
    steps: [
      L(
        'In the seven columns, stack cards in descending order with alternating colours (a red 9 on a black 10). Only a king can go in an empty column.',
        'Dans les sept colonnes, empilez les cartes en ordre décroissant en alternant les couleurs (un 9 rouge sur un 10 noir). Seul un roi peut occuper une colonne vide.',
      ),
      L(
        'Tap a card to play it automatically: to a foundation if it fits, otherwise onto a matching column. You can also drag it, along with the cards on top of it.',
        'Touchez une carte pour la jouer automatiquement : sur une fondation si elle convient, sinon sur une colonne compatible. Vous pouvez aussi la glisser, avec les cartes posées dessus.',
      ),
      L(
        'Tap the stock (top left) to turn cards onto the waste. When it is empty, tap ↻ to turn the waste over again, if redeals remain.',
        'Touchez la pioche (en haut à gauche) pour retourner des cartes sur le talon. Une fois vide, touchez ↻ pour reprendre le talon, s’il vous reste des passes.',
      ),
      L(
        'Levels change the draw: 1 card on Easy to Hard, 3 cards on Expert and Master, and fewer passes through the stock on Medium, Hard and Master.',
        'Les niveaux changent la pioche : 1 carte de Facile à Difficile, 3 cartes en Expert et Maître, et moins de passes en Moyen, Difficile et Maître.',
      ),
      L(
        'Undo takes back a move (Z or Backspace on a keyboard); Space or D draws. Once every card is face up and the stock is empty, the rest goes home on its own.',
        'Annuler reprend un coup (Z ou Retour arrière au clavier); Espace ou D pioche. Quand toutes les cartes sont visibles et la pioche vide, le reste se range tout seul.',
      ),
    ],
    tips: [
      L(
        'Prioritise moves that turn over a face-down card in the columns.',
        'Privilégiez les coups qui retournent une carte cachée dans les colonnes.',
      ),
      L(
        'Don’t empty a column unless you have a king ready to put there.',
        'Ne videz pas une colonne si vous n’avez pas de roi à y placer.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [240, 300, 360, 420, 540]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const rules: KRules = byLevel<KRules>(d, [
      { draw: 1, redeals: -1 },
      { draw: 1, redeals: 2 },
      { draw: 1, redeals: 1 },
      { draw: 3, redeals: -1 },
      { draw: 3, redeals: 2 },
    ]);
    // Bias toward deals a quick greedy player can win (deterministic attempt budget).
    const biasRules: KRules = d === 5 ? { draw: 3, redeals: -1 } : rules;
    const tries = byLevel(d, [500, 500, 500, 600, 600]);
    let s: KState = dealK(deck(rng));
    for (let t = 0; t < tries && !greedyK(s, biasRules); t++) s = dealK(deck(rng));

    const hist = new History<KState>(80);
    const sv = ctx.saved as { s?: unknown; hist?: unknown } | undefined;
    if (sv && validState(sv.s)) {
      s = sv.s;
      hist.restore(sv.hist);
    }

    const table = tableEl(7, TOP + TAB_H);
    let over = false;

    const status = (extra = '') => {
      const home = s.found.reduce((a, b) => a + b, 0);
      const pass = rules.redeals < 0 ? '' : ` · ${L('Pass', 'Passe')} ${s.redeals + 1}/${rules.redeals + 1}`;
      ctx.status(extra || `${L('Home', 'Fondations')} ${home}/52${pass || ` · ${L('Moves', 'Coups')} ${s.moves}`}`);
    };

    const render = () => {
      const kids: HTMLElement[] = [];
      // stock
      const sp = pileEl('s', 0, 0);
      sp.append(slotEl('s', s.waste.length && canRedeal(s, rules) ? '↻' : ''));
      if (s.stock.length) {
        sp.append(cardEl(0, false, 's', s.stock.length - 1, '', 'stock'));
        sp.append(h('span', { class: 'badge' }, s.stock.length));
      }
      kids.push(sp);
      // waste (fanned in draw-3)
      const wp = pileEl('w', 1, 0);
      wp.append(slotEl('w'));
      const show = rules.draw === 3 ? 3 : 1;
      const from = Math.max(0, s.waste.length - show);
      for (let i = from; i < s.waste.length; i++) {
        const top = i === s.waste.length - 1;
        wp.append(cardEl(s.waste[i], true, 'w', i, `--dx:${(i - from) * 0.3}`, top ? '' : 'lock'));
      }
      kids.push(wp);
      // foundations
      for (let su = 0; su < 4; su++) {
        const fp = pileEl('f' + su, 3 + su, 0);
        fp.append(slotEl('f' + su, SUITS[su]));
        if (s.found[su]) fp.append(cardEl(su * 13 + s.found[su] - 1, true, 'f' + su, 0));
        kids.push(fp);
      }
      // tableau
      s.tab.forEach((col, k) => {
        const tp = pileEl('t' + k, k, TOP, TAB_H);
        tp.append(slotEl('t' + k, L('K', 'R')));
        const ys = fan(col.d.length, col.u.length, TAB_H);
        col.d.forEach((c, i) => tp.append(cardEl(c, false, 't' + k, i, `--y:${ys[i]}`)));
        col.u.forEach((c, j) => tp.append(cardEl(c, true, 't' + k, col.d.length + j, `--y:${ys[col.d.length + j]}`)));
        kids.push(tp);
      });
      table.replaceChildren(...kids);
    };

    const after = () => {
      render();
      if (trivialK(s) && !wonK(s)) {
        finishK(s);
        render();
      }
      if (wonK(s)) {
        over = true;
        status(L(`Moves ${s.moves} · All home!`, `${P(s.moves, ['coup', 'coups'], ['coup', 'coups'])} · Tout est rangé!`));
        ctx.solved();
        return;
      }
      if (!hasProgress(s, rules)) {
        if (!canRedeal(s, rules)) {
          over = true;
          status(L('No moves left', 'Aucun coup possible'));
          ctx.failed();
          return;
        }
        status(L('No useful moves left · Undo or skip', 'Plus de coup utile · Annulez ou passez'));
        return;
      }
      status();
    };

    const bump = (p: string, i: number) => {
      const el = table.querySelector(`[data-p="${p}"][data-i="${i}"]`);
      if (el) shake(el);
    };

    const doDraw = () => {
      if (!canDraw(s, rules)) {
        bump('s', -1);
        return;
      }
      hist.push(s);
      draw(s, rules);
      after();
    };

    bindTable(table, {
      canDrag: (p, i) => !over && p !== 's' && picked(s, p, i) != null,
      accepts: (p, i, to) => moveK(s, p, i, to[0] === 'f' ? 'f' : to, true),
      tap(p, i) {
        if (over) return;
        ctx.touch();
        if (p === 's') {
          doDraw();
          return;
        }
        if (i < 0) return;
        const to = bestDest(s, p, i);
        if (!to) {
          bump(p, i);
          return;
        }
        hist.push(s);
        moveK(s, p, i, to);
        after();
      },
      drop(p, i, to) {
        if (over) return false;
        ctx.touch();
        const dest = to[0] === 'f' ? 'f' : to;
        if (!moveK(s, p, i, dest, true)) return false;
        hist.push(s);
        moveK(s, p, i, dest);
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
        if (e.key === ' ' || e.key === 'd') {
          if (!over) {
            ctx.touch();
            doDraw();
          }
          return true;
        }
        return false;
      },
    };
  },
};
