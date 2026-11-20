import { L } from '../core/i18n';
import type { Rng } from '../core/rng';
import { byLevel, type Difficulty, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';

type Op = '+' | '−' | '×' | '÷';

function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b > 0 ? a - b : null;
    case '×': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : null;
  }
}

function generate(d: Difficulty, r: Rng) {
  const count = byLevel(d, [3, 4, 4, 5, 5]);
  const max = byLevel(d, [9, 10, 12, 13, 25]);
  const ops: Op[] = byLevel<Op[]>(d, [['+', '−'], ['+', '−', '×'], ['+', '−', '×', '÷'], ['+', '−', '×', '÷'], ['+', '−', '×', '÷']]);
  const cap = byLevel(d, [40, 100, 200, 400, 999]);
  for (let tries = 0; tries < 500; tries++) {
    const nums = Array.from({ length: count }, () => r.int(1, max));
    const items = [...nums];
    let ok = true;
    while (items.length > 1) {
      const i = r.int(0, items.length - 1);
      const a = items.splice(i, 1)[0];
      const j = r.int(0, items.length - 1);
      const b = items.splice(j, 1)[0];
      const op = r.pick(ops);
      const v = apply(Math.max(a, b), op, Math.min(a, b));
      if (v == null || v > cap) { ok = false; break; }
      items.push(v);
    }
    const target = items[0];
    if (!ok || nums.includes(target) || target < 10) continue;
    return { nums, target, ops };
  }
  return { nums: [2, 3, 4], target: 14, ops: ['+', '−', '×', '÷'] as Op[] };
}

export const target: PuzzleDef = {
  id: 'target',
  get name() { return L('Target', 'Cible'); },
  category: 'numbers',
  get rules() { return L('Combine every number to hit the target.', 'Combinez tous les nombres pour atteindre la cible.'); },
  help: () => ({
    goal: L(
      'Use every number exactly once with + − × ÷ so that the last one left equals the target.',
      'Utilisez chaque nombre une seule fois avec + − × ÷ pour que le dernier qui reste égale la cible.',
    ),
    steps: [
      L('Tap a number, then an operator, then a second number: the two merge into the result.', 'Touchez un nombre, puis un opérateur, puis un deuxième nombre : les deux fusionnent en leur résultat.'),
      L('The result stays selected, so you can chain the next operation right away.', 'Le résultat reste sélectionné : vous pouvez enchaîner l’opération suivante.'),
      L('Subtraction must stay above zero and division must come out even.', 'Une soustraction doit rester au-dessus de zéro et une division doit tomber juste.'),
      L('When one number is left, it must be the target. Undo steps back one merge; Reset starts over.', 'Quand il reste un seul nombre, ce doit être la cible. Annuler défait une fusion; Recommencer repart de zéro.'),
      L('Keyboard: 1 to 5 pick numbers, + - * / pick operators, Backspace or Z undoes.', 'Clavier : 1 à 5 choisissent les nombres, + - * / les opérateurs, Retour arrière ou Z annule.'),
    ],
    tips: [
      L('Work backwards: which product or sum gets close to the target?', 'Partez de la cible : quel produit ou quelle somme s’en approche?'),
      L('Keep a small number for a final + or − adjustment.', 'Gardez un petit nombre pour un ajustement final avec + ou −.'),
    ],
  }),
  par: (d) => byLevel(d, [25, 40, 60, 90, 120]),
  create(ctx) {
    const { root, rng, difficulty } = ctx;
    const { nums, target: goal } = generate(difficulty, rng);
    const allOps: Op[] = ['+', '−', '×', '÷'];
    type Chip = { id: number; v: number };
    let nextId = 0;
    const initial = (): Chip[] => nums.map((v) => ({ id: nextId++, v }));
    let chips = initial();
    let history: Chip[][] = [];
    let sel: number | null = null;
    let op: Op | null = null;

    const goalEl = h('div', { class: 'big' }, goal);
    const chipRow = h('div', { class: 'chips' });
    const opRow = h('div', { class: 'pad' });

    const render = () => {
      chipRow.replaceChildren(
        ...chips.map((c) =>
          h('button', { type: 'button', class: `chip num ${c.id === sel ? 'sel' : ''}`, onclick: () => tapChip(c.id) }, c.v),
        ),
      );
      opRow.replaceChildren(
        ...allOps.map((o) => h('button', { type: 'button', class: `key ${o === op ? 'sel' : ''}`, onclick: () => tapOp(o) }, o)),
      );
    };

    const tapChip = (id: number) => {
      ctx.touch();
      if (sel === null || op === null) {
        sel = sel === id ? null : id;
        op = null;
        render();
        return;
      }
      if (id === sel) { sel = null; op = null; render(); return; }
      const a = chips.find((c) => c.id === sel)!;
      const b = chips.find((c) => c.id === id)!;
      const v = apply(a.v, op, b.v);
      if (v == null) {
        ctx.mistake();
        shake(chipRow);
        op = null;
        render();
        return;
      }
      history.push(chips);
      const merged = { id: nextId++, v };
      chips = chips.filter((c) => c.id !== a.id).map((c) => (c.id === b.id ? merged : c));
      sel = merged.id;
      op = null;
      render();
      if (chips.length === 1) {
        if (v === goal) ctx.solved();
        else { shake(chipRow); ctx.status(L('Not quite — undo and try again', 'Raté — annulez et réessayez')); }
      }
    };
    const tapOp = (o: Op) => {
      if (sel === null) return;
      op = op === o ? null : o;
      render();
    };
    const undo = () => {
      const prev = history.pop();
      if (!prev) return;
      chips = prev;
      sel = null;
      op = null;
      ctx.status('');
      render();
    };
    const reset = () => {
      if (!history.length) return;
      chips = history[0];
      history = [];
      sel = null;
      op = null;
      ctx.status('');
      render();
    };

    const sv = ctx.saved as { chips?: Chip[]; history?: Chip[][]; nextId?: number; sel?: number | null } | undefined;
    if (Array.isArray(sv?.chips) && sv.chips.length) {
      chips = sv.chips;
      history = sv.history ?? [];
      nextId = sv.nextId ?? 1000;
      sel = sv.sel != null && chips.some((c) => c.id === sv.sel) ? sv.sel : null;
    }
    root.append(h('div', { class: 'label' }, L('target', 'cible')), goalEl, chipRow, opRow);
    ctx.controls(btn(L('Undo', 'Annuler'), undo, 'ghost'), btn(L('Reset', 'Recommencer'), reset, 'ghost'));
    render();

    return {
      snapshot: () => ({ chips, history, nextId, sel }),
      onKey(e) {
        const map: Record<string, Op> = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷' };
        if (map[e.key]) { tapOp(map[e.key]); return true; }
        if (e.key === 'Backspace' || (e.key === 'z')) { undo(); return true; }
        const n = Number(e.key);
        if (n >= 1 && n <= chips.length) { tapChip(chips[n - 1].id); return true; }
        return false;
      },
    };
  },
};
