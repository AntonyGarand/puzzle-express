import './pyramid.css';
import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import { cardEl, deck, pileEl, rank, slotEl, tableEl } from './cardkit/cards';
import { cardAt, canRecycle, clearedP, dealP, drawP, exposed, idx, removeP, solveP, stuckP, type PState } from './cardkit/pyramid';
import { bindTable, History } from './cardkit/table';

const STEP = 0.7; // row step in card widths
const BOTTOM = 6 * STEP + 1.4 + 0.45; // stock row y

function validState(v: unknown): v is PState {
  const s = v as PState;
  if (!s || !Array.isArray(s.pyr) || s.pyr.length !== 28 || !Array.isArray(s.stock) || !Array.isArray(s.waste)) return false;
  return typeof s.passes === 'number' && typeof s.moves === 'number' && s.stock.length + s.waste.length <= 24;
}

export const pyramid: PuzzleDef = {
  id: 'pyramid',
  get name() {
    return L('Pyramid', 'Pyramide');
  },
  category: 'cards',
  get rules() {
    return L('Pair open cards that add to 13 (K alone). Clear the top.', 'Retirez des paires qui font 13 (R seul). Videz la pyramide.');
  },
  help: () => ({
    goal: L(
      'Remove all 28 cards of the pyramid by pairing cards whose values add up to 13.',
      'Retirez les 28 cartes de la pyramide en formant des paires dont la valeur totale fait 13.',
    ),
    steps: [
      L(
        'Values: A = 1, numbers as shown, J = 11, Q = 12, K = 13. A king is removed on its own; other pairs must total 13 (Q + A, J + 2, 10 + 3…).',
        'Valeurs : A = 1, les chiffres tels quels, V = 11, D = 12, R = 13. Un roi se retire seul; les autres paires doivent totaliser 13 (D + A, V + 2, 10 + 3…).',
      ),
      L(
        'Only open cards can be used: a pyramid card is open once both cards covering it are gone. The top card of the waste is open too.',
        'Seules les cartes libres comptent : une carte de la pyramide se libère quand les deux cartes qui la couvrent sont parties. La carte du dessus du talon est libre aussi.',
      ),
      L(
        'Tap one card, then its partner; or drag one card onto the other (on a touch screen, hold it a moment first). Tap a king to remove it.',
        'Touchez une carte, puis sa partenaire; ou glissez une carte sur l’autre (sur écran tactile, maintenez-la un instant d’abord). Touchez un roi pour le retirer.',
      ),
      L(
        'Tap the stock to turn one card onto the waste. When it runs out, ↻ starts a new pass: unlimited on Easy, 3 on Medium, 2 on Hard and Expert, 1 on Master.',
        'Touchez la pioche pour retourner une carte sur le talon. Quand elle est vide, ↻ lance une nouvelle passe : illimitées en Facile, 3 en Moyen, 2 en Difficile et Expert, 1 en Maître.',
      ),
      L(
        'Undo takes back a move (Z or Backspace on a keyboard); Space or D draws.',
        'Annuler reprend un coup (Z ou Retour arrière au clavier); Espace ou D pioche.',
      ),
    ],
    tips: [
      L(
        'Before pairing, check which choice uncovers more of the pyramid.',
        'Avant de former une paire, voyez quel choix dégage le plus la pyramide.',
      ),
      L(
        'Work on the bottom rows early: cards near the top only open up late.',
        'Attaquez tôt les rangées du bas : les cartes du sommet se libèrent tard.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [90, 120, 150, 180, 210]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const passes = byLevel(d, [-1, 3, 2, 2, 1]); // -1 = unlimited
    const solvePasses = passes < 0 ? 3 : passes;
    const tries = byLevel(d, [10, 10, 16, 6, 30]);
    const budget = d === 5 ? 2000 : 5000;
    let s = dealP(deck(rng));
    for (let t = 1; t < tries && !solveP(s, solvePasses, budget); t++) s = dealP(deck(rng));

    const hist = new History<PState>(80);
    let sel: string | null = null;
    const sv = ctx.saved as { s?: unknown; hist?: unknown; sel?: unknown } | undefined;
    if (sv && validState(sv.s)) {
      s = sv.s;
      hist.restore(sv.hist);
      if (typeof sv.sel === 'string' && cardAt(s, sv.sel) != null) sel = sv.sel;
    }

    const table = tableEl(7, BOTTOM + 1.4);
    let over = false;

    const status = () => {
      const left = s.pyr.filter((c) => c >= 0).length;
      const pass = passes < 0 ? '' : ` · ${L('Pass', 'Passe')} ${s.passes + 1}/${passes}`;
      const rest = L(`${left} left`, `Reste ${left}`);
      ctx.status(`${rest} · ${L('Stock', 'Pioche')} ${s.stock.length}${pass}`);
    };

    const render = () => {
      const kids: HTMLElement[] = [];
      for (let r = 0; r < 7; r++) {
        for (let k = 0; k <= r; k++) {
          const i = idx(r, k);
          if (s.pyr[i] < 0) continue;
          const p = 'p' + i;
          const pp = pileEl(p, (6 - r) / 2 + k, r * STEP);
          const open = exposed(s.pyr, i);
          pp.append(cardEl(s.pyr[i], true, p, 0, '', open ? (sel === p ? 'sel' : '') : 'lock'));
          kids.push(pp);
        }
      }
      const sp = pileEl('s', 2, BOTTOM);
      sp.append(slotEl('s', canRecycle(s, passes) ? '↻' : '✕'));
      if (s.stock.length) {
        sp.append(cardEl(0, false, 's', 0, '', 'stock'));
        sp.append(h('span', { class: 'badge' }, s.stock.length));
      }
      kids.push(sp);
      const wp = pileEl('w', 4, BOTTOM);
      wp.append(slotEl('w'));
      if (s.waste.length > 1) wp.append(cardEl(s.waste[s.waste.length - 2], true, 'w', 1, '', 'lock'));
      if (s.waste.length) wp.append(cardEl(s.waste[s.waste.length - 1], true, 'w', 0, '', sel === 'w' ? 'sel' : ''));
      kids.push(wp);
      table.replaceChildren(...kids);
    };

    const after = () => {
      if (sel && cardAt(s, sel) == null) sel = null;
      render();
      if (clearedP(s)) {
        over = true;
        ctx.status(L(`Pyramid cleared in ${s.moves} moves`, `Pyramide vidée en ${P(s.moves, ['coup', 'coups'], ['coup', 'coups'])}`));
        ctx.solved();
        return;
      }
      if (stuckP(s, passes)) {
        over = true;
        ctx.status(L('No pairs left', 'Plus aucune paire possible'));
        ctx.failed();
        return;
      }
      status();
    };

    const bump = (p: string) => {
      const el = table.querySelector(`[data-p="${p}"]`);
      if (el) shake(el);
    };

    const draw = () => {
      sel = null;
      const n = { ...s, stock: s.stock.slice(), waste: s.waste.slice() };
      if (!drawP(n, passes)) {
        bump('s');
        render();
        return;
      }
      hist.push(s);
      s = n;
      after();
    };

    const pick = (p: string) => {
      const c = cardAt(s, p);
      if (c == null) {
        bump(p);
        return;
      }
      if (rank(c) === 13) {
        hist.push(s);
        removeP(s, p);
        after();
        return;
      }
      if (sel == null || sel === p) {
        sel = sel === p ? null : p;
        render();
        return;
      }
      if (removeP(s, sel, p, true)) {
        hist.push(s);
        removeP(s, sel, p);
        sel = null;
        after();
        return;
      }
      sel = p;
      render();
    };

    bindTable(table, {
      canDrag: (p, i) => !over && p !== 's' && (p !== 'w' || i === 0) && cardAt(s, p) != null,
      accepts: (p, _i, to) => removeP(s, p, to, true),
      tap(p, i) {
        if (over) return;
        ctx.touch();
        if (p === 's') {
          draw();
          return;
        }
        if (p === 'w' && i !== 0) return;
        pick(p);
      },
      drop(p, _i, to) {
        if (over || !removeP(s, p, to, true)) return false;
        ctx.touch();
        hist.push(s);
        removeP(s, p, to);
        sel = null;
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
      sel = null;
      render();
      status();
    };
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'));
    root.append(table);
    render();
    status();

    return {
      snapshot: () => ({ s, hist: hist.stack, sel }),
      onKey(e) {
        if (e.key === 'z' || e.key === 'Backspace') {
          undo();
          return true;
        }
        if (e.key === ' ' || e.key === 'd') {
          if (!over) {
            ctx.touch();
            draw();
          }
          return true;
        }
        return false;
      },
    };
  },
};
