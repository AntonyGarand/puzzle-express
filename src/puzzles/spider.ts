import './spider.css';
import { L, P } from '../core/i18n';
import { byLevel, type Hint, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import { cardEl, elAt, fan, label, leCard, pileEl, rank, slotEl, suit, SUITS, tableEl, topEl } from './cardkit/cards';
import { bestDestS, canDealS, dealRow, genS, hasMoveS, moveS, pickedS, progressS, wonS, type SState } from './cardkit/spider';
import { bindTable, History } from './cardkit/table';

const TOP = 1.7;

interface Cfg {
  suits: number[];
  copies: number;
  cols: number;
  dealt: number;
  tab: number;
  /** How often a card turned up while building the deal is one that fits (0 to 1). */
  help: number;
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
        'Tap a card to send it to the best spot (same suit first), or drag it (on a touch screen, hold it a moment first). Face-down cards turn over once uncovered.',
        'Touchez une carte pour l’envoyer au meilleur endroit (même sorte d’abord), ou glissez-la (sur écran tactile, maintenez-la un instant d’abord). Les cartes cachées se retournent une fois dégagées.',
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
      { suits: [0], copies: 4, cols: 8, dealt: 36, tab: 9, help: 0.3 },
      { suits: [0], copies: 6, cols: 8, dealt: 46, tab: 9, help: 0.5 },
      { suits: [0, 1], copies: 3, cols: 8, dealt: 46, tab: 9, help: 0.8 },
      { suits: [0, 1], copies: 4, cols: 10, dealt: 54, tab: 10.5, help: 0.7 },
      { suits: [0, 1, 2, 3], copies: 2, cols: 10, dealt: 54, tab: 10.5, help: 0.9 },
    ]);
    const runs = cfg.suits.length * cfg.copies;
    // Always winnable: dealt by playing a winning game (see genS).
    let s = genS(rng, cfg.suits, cfg.copies, cfg.cols, cfg.dealt, cfg.help).s;
    const hist = new History<SState>(60);
    const sv = ctx.saved as { s?: unknown; hist?: unknown } | undefined;
    if (sv && validState(sv.s, cfg)) {
      s = sv.s;
      hist.restore(sv.hist);
    }
    const table = tableEl(cfg.cols, TOP + cfg.tab, cfg.suits.length > 2 ? 'four-colour' : '');
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
      // No deal left and no way to turn a card or finish a run: shuffling runs around can't win.
      if (!hasMoveS(s) || !progressS(s)) {
        over = true;
        ctx.status(L('No useful moves left', 'Plus aucun coup utile'));
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

    /** Apply a validated move (tap, drop and the guide all come through here). */
    const go = (p: string, i: number, to: string) => {
      hist.push(s);
      moveS(s, p, i, to);
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
        go(p, i, to);
      },
      drop(p, i, to) {
        if (over || !moveS(s, p, i, to, true)) return false;
        ctx.touch();
        go(p, i, to);
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

    let lastRule = '';
    const hint = (): Hint | null => {
      if (over) return null;
      type M = { a: number; i: number; b: number; rule: string; rank: number };
      const moves: M[] = [];
      const n = s.cols.length;
      for (let a = 0; a < n; a++) {
        const src = s.cols[a];
        for (let k = 0; k < src.u.length; k++) {
          const i = src.d.length + k;
          if (!pickedS(s, 't' + a, i)) continue;
          const c = src.u[k];
          const reveals = k === 0 && src.d.length > 0;
          for (let b = 0; b < n; b++) {
            if (b === a || !moveS(s, 't' + a, i, 't' + b, true)) continue;
            const dst = s.cols[b].u[s.cols[b].u.length - 1];
            const same = dst != null && suit(dst) === suit(c);
            // Would this finish a K→A run?
            const sim: typeof s = { ...s, cols: s.cols.map((x) => ({ d: x.d.slice(), u: x.u.slice() })), done: s.done.slice() };
            moveS(sim, 't' + a, i, 't' + b);
            const completes = sim.done.length > s.done.length;
            let rule = '';
            if (completes) rule = 'done';
            else if (dst == null) rule = reveals ? 'empty' : '';
            else if (reveals) rule = same ? 'reveal' : 'mixed';
            else if (same && k === 0 && !src.d.length) rule = 'clear';
            else if (same && k > 0 && (suit(src.u[k - 1]) !== suit(c) || rank(src.u[k - 1]) !== rank(c) + 1)) rule = 'build';
            if (rule)
              moves.push({
                a,
                i,
                b,
                rule,
                rank: ['done', 'reveal', 'clear', 'mixed', 'build', 'empty'].indexOf(rule) * 100 - src.d.length,
              });
          }
        }
      }
      moves.sort((x, y) => x.rank - y.rank);
      if (!moves.length) {
        if (!canDealS(s)) return null;
        lastRule = 'deal';
        return {
          text: L(
            `No useful move left: tap the stock to deal a new row, one card on every column. ${s.stock.length / n === 1 ? 'This is the last one.' : `The stock holds ${s.stock.length / n}.`}`,
            `Plus de coup utile : touchez la pioche pour donner une nouvelle rangée, une carte par colonne. ${s.stock.length / n === 1 ? 'C’est la dernière.' : `La pioche en contient ${s.stock.length / n}.`}`,
          ),
          at: [topEl(table, 's')!],
          play: deal,
        };
      }
      // Best move first; vary the lesson only between moves that also turn a card over.
      const m = moves.find((x) => x.rule !== lastRule && x.rank < moves[0].rank + 300 && x.rule !== 'build') ?? moves[0];
      lastRule = m.rule;
      const src = s.cols[m.a];
      const c = src.u[m.i - src.d.length];
      const cnt = src.u.length - (m.i - src.d.length);
      const dst = s.cols[m.b].u[s.cols[m.b].u.length - 1];
      const what =
        cnt > 1 ? L(`the ${label(c)} run (${cnt} cards)`, `la suite du ${label(c)} (${cnt} cartes)`) : L(`the ${label(c)}`, leCard(c));
      const dn = dst != null ? label(dst) : '';
      const texts: Record<string, string> = {
        done: L(
          `Move ${what} onto the ${dn}: that completes K to A in ${SUITS[suit(c)]}, and a finished run leaves the table.`,
          `Déplacez ${what} sur le ${dn} : cela complète une suite du R à l’A en ${SUITS[suit(c)]}, et une suite complète quitte la table.`,
        ),
        reveal: L(
          `Move ${what} onto the ${dn}: one lower and the same suit, so they can later move together. The hidden card underneath turns over.`,
          `Déplacez ${what} sur le ${dn} : une valeur de moins et même sorte, ils pourront bouger ensemble. La carte cachée dessous se retourne.`,
        ),
        mixed: L(
          `Any card one lower fits, even of another suit: move ${what} onto the ${dn} to turn over the hidden card. Mixed suits can’t move as a block, though.`,
          `N’importe quelle carte d’une valeur de moins convient, même d’une autre sorte : déplacez ${what} sur le ${dn} pour retourner la carte cachée. Mais des sortes mêlées ne bougent pas en bloc.`,
        ),
        clear: L(
          `Move ${what} onto the ${dn} (same suit, one lower): that empties a column, and an empty column takes any card.`,
          `Déplacez ${what} sur le ${dn} (même sorte, une valeur de moins) : cela vide une colonne, et une colonne vide accepte n’importe quelle carte.`,
        ),
        build: L(
          `Join ${what} to the ${dn}: same suit, one lower. Same-suit runs grow toward a full K-to-A set.`,
          `Joignez ${what} au ${dn} : même sorte, une valeur de moins. Les suites d’une même sorte grandissent vers un ensemble complet du R à l’A.`,
        ),
        empty: L(
          `An empty column takes any card: move ${what} there and turn over the hidden card it covered.`,
          `Une colonne vide accepte n’importe quelle carte : déplacez-y ${what} et retournez la carte cachée qu’elle couvrait.`,
        ),
      };
      return {
        text: texts[m.rule],
        why: Array.from({ length: cnt }, (_, j) => elAt(table, 't' + m.a, m.i + j)!),
        at: [topEl(table, 't' + m.b)!],
        play: () => go('t' + m.a, m.i, 't' + m.b),
      };
    };

    return {
      hint,
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
