import './spider.css';
import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import { cardEl, deck, fan, pileEl, slotEl, tableEl } from './cardkit/cards';
import { bestDestS, canDealS, dealRow, dealS, hasMoveS, moveS, pickedS, wonS, type SState } from './cardkit/spider';
import { bindTable, History } from './cardkit/table';

const TOP = 1.7;

interface Cfg {
  suits: number[];
  copies: number;
  cols: number;
  dealt: number;
  tab: number;
}

function validState(v: unknown, cfg: Cfg): v is SState {
  const s = v as SState;
  if (!s || !Array.isArray(s.cols) || s.cols.length !== cfg.cols || !Array.isArray(s.stock) || !Array.isArray(s.done)) return false;
  if (!s.cols.every((c) => Array.isArray(c?.d) && Array.isArray(c?.u)) || typeof s.moves !== 'number') return false;
  const n = s.stock.length + s.done.length * 13 + s.cols.reduce((a, c) => a + c.d.length + c.u.length, 0);
  return n === cfg.suits.length * cfg.copies * 13;
}

export const spider: PuzzleDef = {
  id: 'spider',
  get name() {
    return L('Spider', 'Araignée');
  },
  category: 'cards',
  get rules() {
    return L('Stack down; full K→A runs of one suit clear away.', 'Empilez en descendant; les suites R→A d’une sorte partent.');
  },
  help: () => ({
    goal: L(
      'Build complete runs from king down to ace in a single suit. Each finished run leaves the table; clear every card to win.',
      'Formez des suites complètes du roi jusqu’à l’as dans une même sorte. Chaque suite terminée quitte la table; videz-la au complet pour gagner.',
    ),
    steps: [
      L(
        'Put any card on a card one rank higher, whatever the suit (a 6 on any 7). Any card or run can go in an empty column.',
        'Posez une carte sur une carte d’un rang supérieur, peu importe la sorte (un 6 sur n’importe quel 7). Une colonne vide accepte n’importe quelle carte ou suite.',
      ),
      L(
        'Only a run of the same suit moves as one block. A finished king-to-ace run is removed automatically.',
        'Seule une suite de la même sorte se déplace en bloc. Une suite complète du roi à l’as est retirée automatiquement.',
      ),
      L(
        'Tap a card to send it to the best spot (same suit first), or drag it. Face-down cards turn over once uncovered.',
        'Touchez une carte pour l’envoyer au meilleur endroit (même sorte d’abord), ou glissez-la. Les cartes cachées se retournent une fois dégagées.',
      ),
      L(
        'Tap the stock (top left) to deal one card on every column. You can only deal when no column is empty.',
        'Touchez la pioche (en haut à gauche) pour donner une carte sur chaque colonne. Impossible de donner tant qu’une colonne est vide.',
      ),
      L(
        'Easy and Medium use one suit, Hard and Expert two, Master all four; higher levels have more cards and columns. Undo: Z or Backspace; deal: Space or D.',
        'Facile et Moyen utilisent une sorte, Difficile et Expert deux, Maître les quatre; plus le niveau monte, plus il y a de cartes et de colonnes. Annuler : Z ou Retour arrière; donner : Espace ou D.',
      ),
    ],
    tips: [
      L(
        'Build in the same suit whenever you can: mixed runs get stuck.',
        'Empilez dans la même sorte dès que possible : les suites mélangées bloquent.',
      ),
      L(
        'An empty column is precious; use it to reorder runs before dealing.',
        'Une colonne vide est précieuse; servez-vous-en pour réordonner avant de donner.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [240, 360, 540, 900, 1500]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const cfg = byLevel<Cfg>(d, [
      { suits: [0], copies: 4, cols: 8, dealt: 36, tab: 9 },
      { suits: [0], copies: 6, cols: 8, dealt: 46, tab: 9 },
      { suits: [0, 1], copies: 3, cols: 8, dealt: 46, tab: 9 },
      { suits: [0, 1], copies: 4, cols: 10, dealt: 54, tab: 10.5 },
      { suits: [0, 1, 2, 3], copies: 2, cols: 10, dealt: 54, tab: 10.5 },
    ]);
    const runs = cfg.suits.length * cfg.copies;
    let s = dealS(deck(rng, cfg.suits, cfg.copies), cfg.cols, cfg.dealt);
    const hist = new History<SState>(60);
    const sv = ctx.saved as { s?: unknown; hist?: unknown } | undefined;
    if (sv && validState(sv.s, cfg)) {
      s = sv.s;
      hist.restore(sv.hist);
    }
    const table = tableEl(cfg.cols, TOP + cfg.tab);
    let over = false;

    const status = () => {
      const deals = s.stock.length / cfg.cols;
      ctx.status(`${L('Runs', 'Suites')} ${s.done.length}/${runs} · ${L('Deals', 'Donnes')} ${deals} · ${L('Moves', 'Coups')} ${s.moves}`);
    };

    const render = () => {
      const kids: HTMLElement[] = [];
      const sp = pileEl('s', 0, 0);
      sp.append(slotEl('s'));
      const deals = s.stock.length / cfg.cols;
      for (let k = 0; k < Math.min(deals, 5); k++) sp.append(cardEl(0, false, 's', k, `--dx:${k * 0.12}`, 'stock'));
      if (deals) sp.append(h('span', { class: 'badge' }, deals));
      kids.push(sp);
      const dp = pileEl('done', 2, 0);
      if (!s.done.length) dp.append(slotEl('done', L('K', 'R')));
      s.done.forEach((su, k) => dp.append(cardEl(su * 13 + 12, true, 'done', k, `--dx:${k * 0.32}`, 'lock')));
      kids.push(dp);
      s.cols.forEach((col, k) => {
        const tp = pileEl('t' + k, k, TOP, cfg.tab);
        tp.append(slotEl('t' + k));
        const ys = fan(col.d.length, col.u.length, cfg.tab, 0.18, 0.42);
        col.d.forEach((c, i) => tp.append(cardEl(c, false, 't' + k, i, `--y:${ys[i]}`)));
        col.u.forEach((c, j) => tp.append(cardEl(c, true, 't' + k, col.d.length + j, `--y:${ys[col.d.length + j]}`)));
        kids.push(tp);
      });
      table.replaceChildren(...kids);
    };

    const after = () => {
      render();
      if (wonS(s)) {
        over = true;
        ctx.status(
          L(
            `All ${runs} runs cleared in ${s.moves} moves`,
            `Les ${runs} suites sont faites en ${P(s.moves, ['coup', 'coups'], ['coup', 'coups'])}`,
          ),
        );
        ctx.solved();
        return;
      }
      if (!hasMoveS(s)) {
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

    const deal = () => {
      if (!canDealS(s)) {
        bump('s', 0);
        if (s.stock.length) ctx.status(L('Fill every empty column before dealing', 'Remplissez les colonnes vides avant de donner'));
        return;
      }
      hist.push(s);
      dealRow(s);
      after();
    };

    bindTable(table, {
      canDrag: (p, i) => !over && pickedS(s, p, i) != null,
      accepts: (p, i, to) => moveS(s, p, i, to, true),
      tap(p, i) {
        if (over) return;
        ctx.touch();
        if (p === 's') {
          deal();
          return;
        }
        if (i < 0 || p === 'done') return;
        const to = bestDestS(s, p, i);
        if (!to) {
          bump(p, i);
          return;
        }
        hist.push(s);
        moveS(s, p, i, to);
        after();
      },
      drop(p, i, to) {
        if (over || !moveS(s, p, i, to, true)) return false;
        ctx.touch();
        hist.push(s);
        moveS(s, p, i, to);
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
            deal();
          }
          return true;
        }
        return false;
      },
    };
  },
};
