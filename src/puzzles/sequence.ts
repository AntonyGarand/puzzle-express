import { L } from '../core/i18n';
import type { Rng } from '../core/rng';
import { byLevel, type Difficulty, type PuzzleDef } from '../core/types';
import { h, shake } from '../core/ui';

type Gen = { min: Difficulty; max: Difficulty; make: (r: Rng) => number[] };

const take = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

const GENS: Gen[] = [
  { min: 1, max: 2, make: (r) => { const a = r.int(1, 20), k = r.int(2, 9); return take(6, (i) => a + k * i); } },
  { min: 1, max: 2, make: (r) => { const a = r.int(50, 120), k = r.int(2, 9); return take(6, (i) => a - k * i); } },
  { min: 2, max: 3, make: (r) => { const a = r.int(1, 5), k = r.pick([2, 3]); return take(6, (i) => a * k ** i); } },
  { min: 2, max: 4, make: (r) => { const a = r.int(1, 10), s = r.int(1, 4), t = r.int(1, 3); return take(6, (i) => a + s * i + (t * i * (i - 1)) / 2); } },
  { min: 3, max: 4, make: (r) => { const o = r.int(-3, 5); return take(6, (i) => (i + 1) ** 2 + o); } },
  { min: 3, max: 5, make: (r) => { let a = r.int(1, 5), b = r.int(1, 6); const out = [a, b]; while (out.length < 7) { [a, b] = [b, a + b]; out.push(b); } return out; } },
  { min: 3, max: 5, make: (r) => { const p = r.int(2, 7), m = r.pick([2, 3]); let v = r.int(1, 6); return take(7, (i) => (i === 0 ? v : (v = i % 2 ? v + p : v * m))); } },
  { min: 4, max: 5, make: (r) => { const a = r.int(1, 10), k = r.int(2, 6), b = r.int(30, 60), j = r.int(2, 5); return take(8, (i) => (i % 2 ? b - j * ((i - 1) / 2) : a + k * (i / 2))); } },
  { min: 4, max: 5, make: (r) => { const o = r.int(-2, 4); return take(6, (i) => (i + 1) ** 3 + o); } },
  { min: 4, max: 5, make: (r) => { const s = r.int(0, 3); return take(6, (i) => ((i + 1 + s) * (i + 2 + s)) / 2); } },
  { min: 5, max: 5, make: (r) => { const ps = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]; const s = r.int(0, 5); return ps.slice(s, s + 6); } },
  { min: 5, max: 5, make: (r) => { let v = r.int(1, 4); const a = r.int(1, 3); return take(6, (i) => (i === 0 ? v : (v = v * 2 + a))); } },
  { min: 5, max: 5, make: (r) => { let v = r.int(2, 6); return take(6, (i) => (i === 0 ? v : (v = v + i * i))); } },
];

export const sequence: PuzzleDef = {
  id: 'sequence',
  get name() { return L('Sequence', 'Suites'); },
  category: 'numbers',
  get rules() { return L('Find the next number. Two rounds.', 'Trouvez le nombre suivant. Deux manches.'); },
  help: () => ({
    goal: L(
      'Spot the pattern in a row of numbers and give the next one. Two rounds.',
      'Trouvez la logique d’une suite de nombres et donnez le suivant. Deux manches.',
    ),
    steps: [
      L('A sequence of numbers is shown, ending with a ?.', 'Une suite de nombres s’affiche, terminée par un ?.'),
      L('Work out the rule: adding, subtracting, multiplying, squares, adding the two previous terms…', 'Trouvez la règle : addition, soustraction, multiplication, carrés, somme des deux termes précédents…'),
      L('Type the missing number and press Enter.', 'Tapez le nombre manquant et appuyez sur Entrée.'),
      L('A wrong answer shakes and counts as a mistake; you can try again.', 'Une mauvaise réponse fait trembler le champ et compte comme une erreur; vous pouvez réessayer.'),
    ],
    tips: [
      L('Write down the gaps between neighbours. If the gaps change, look at the gaps between gaps.', 'Notez les écarts entre voisins. S’ils changent, regardez les écarts entre ces écarts.'),
      L('Some sequences alternate two rules, or switch between + and ×.', 'Certaines suites alternent deux règles, ou passent de + à ×.'),
    ],
  }),
  par: (d) => byLevel(d, [15, 25, 40, 60, 80]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const pool = GENS.filter((g) => g.min <= d && g.max >= d);
    const total = 2;
    let used: Gen | null = null;
    const rounds = Array.from({ length: total }, () => {
      const choices = pool.length > 1 ? pool.filter((g) => g !== used) : pool;
      used = rng.pick(choices);
      return used.make(rng);
    });
    const saved = ctx.saved as { round: number } | undefined;
    let round = Math.min(saved?.round ?? 0, total - 1);
    let seq: number[] = [];
    const terms = h('div', { class: 'seq' });
    const dots = h('div', { class: 'dots' });
    const input = h('input', { class: 'input', inputmode: 'numeric', autocomplete: 'off', placeholder: '?', 'aria-label': L('Next term', 'Terme suivant') });

    const newRound = () => {
      seq = rounds[round];
      const shown = seq.slice(0, -1);
      terms.replaceChildren(...shown.map((n) => h('span', { class: 'term' }, n)), h('span', { class: 'term q' }, '?'));
      dots.replaceChildren(...Array.from({ length: total }, (_, k) => h('span', { class: k < round ? 'dot on' : k === round ? 'dot cur' : 'dot' })));
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      ctx.touch();
      if (Number(input.value.trim().replace('−', '-')) === seq[seq.length - 1]) {
        round++;
        input.value = '';
        if (round >= total) ctx.solved();
        else newRound();
      } else {
        ctx.mistake();
        shake(input);
        input.select();
      }
    });
    root.append(dots, terms, input);
    newRound();
    return { activate: () => input.focus({ preventScroll: true }), snapshot: () => ({ round }) };
  },
};
