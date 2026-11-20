import { L } from '../core/i18n';
import type { Rng } from '../core/rng';
import { byLevel, type Difficulty, type PuzzleDef } from '../core/types';
import { h, shake } from '../core/ui';

interface Problem {
  text: string;
  answer: number;
}

function gen(d: Difficulty, r: Rng): Problem {
  const pick = r.int(0, 2);
  switch (d) {
    case 1: {
      const a = r.int(2, 15), b = r.int(2, 12);
      return r.chance(0.5) ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a };
    }
    case 2: {
      if (pick === 0) {
        const a = r.int(2, 9), b = r.int(2, 9);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      const a = r.int(15, 70), b = r.int(8, 40);
      return pick === 1 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a };
    }
    case 3: {
      if (pick === 0) {
        const a = r.int(3, 12), b = r.int(3, 12), c = r.int(2, 30);
        return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
      }
      if (pick === 1) {
        const b = r.int(2, 9), q = r.int(3, 12);
        return { text: `${b * q} ÷ ${b}`, answer: q };
      }
      const a = r.int(20, 90), b = r.int(10, 60), c = r.int(5, 40);
      return { text: `${a} + ${b} − ${c}`, answer: a + b - c };
    }
    case 4: {
      if (pick === 0) {
        const a = r.int(2, 15), b = r.int(2, 15), c = r.int(3, 9);
        return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
      }
      if (pick === 1) {
        const a = r.int(4, 12), b = r.int(4, 12), c = r.int(2, 9), d2 = r.int(2, 9);
        const big = a * b >= c * d2;
        return big
          ? { text: `${a} × ${b} − ${c} × ${d2}`, answer: a * b - c * d2 }
          : { text: `${c} × ${d2} − ${a} × ${b}`, answer: c * d2 - a * b };
      }
      const a = r.int(11, 25), b = r.int(3, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case 5: {
      if (pick === 0) {
        const a = r.int(12, 39), b = r.int(12, 29);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      if (pick === 1) {
        const a = r.int(11, 25);
        const b = r.int(2, 30);
        return { text: `${a}² − ${b}`, answer: a * a - b };
      }
      const b = r.int(3, 12), q = r.int(12, 40), c = r.int(3, 9);
      return { text: `${b * q} ÷ ${b} × ${c}`, answer: q * c };
    }
  }
}

export const quickmath: PuzzleDef = {
  id: 'quickmath',
  get name() { return L('Quick Math', 'Calcul éclair'); },
  category: 'numbers',
  get rules() { return L('Three sums in a row. Enter to submit.', 'Trois calculs d’affilée. Entrée pour valider.'); },
  help: () => ({
    goal: L(
      'Solve three quick calculations in a row, as fast as you can.',
      'Résolvez trois calculs rapides d’affilée, le plus vite possible.',
    ),
    steps: [
      L('A calculation appears. The dots above it show which of the three you are on.', 'Un calcul s’affiche. Les points au-dessus indiquent lequel des trois vous faites.'),
      L('Type the answer and press Enter (or Go on a phone keyboard).', 'Tapez la réponse et appuyez sur Entrée (ou OK sur le clavier du téléphone).'),
      L('A right answer brings up the next one. A wrong one shakes and counts as a mistake: just try again.', 'Une bonne réponse passe au calcul suivant. Une mauvaise fait trembler le champ et compte comme une erreur : réessayez.'),
      L('Higher levels add multiplication, division, brackets and squares.', 'Les niveaux supérieurs ajoutent multiplications, divisions, parenthèses et carrés.'),
    ],
    tips: [
      L('Split big products: 23 × 14 = 23 × 10 + 23 × 4.', 'Décomposez les gros produits : 23 × 14 = 23 × 10 + 23 × 4.'),
      L('Do brackets and × or ÷ before + and −.', 'Faites les parenthèses, puis × et ÷, avant + et −.'),
    ],
  }),
  par: (d) => byLevel(d, [12, 20, 30, 45, 60]),
  create(ctx) {
    const { root, rng, difficulty } = ctx;
    const total = 3;
    const probs = Array.from({ length: total }, () => gen(difficulty, rng));
    const saved = ctx.saved as { i: number } | undefined;
    let i = Math.min(saved?.i ?? 0, total - 1);
    let prob = probs[i];
    const expr = h('div', { class: 'big' });
    const dots = h('div', { class: 'dots' });
    const input = h('input', {
      class: 'input',
      inputmode: 'numeric',
      autocomplete: 'off',
      enterkeyhint: 'go',
      'aria-label': L('Answer', 'Réponse'),
      placeholder: '?',
    });
    const render = () => {
      expr.textContent = `${prob.text} =`;
      dots.replaceChildren(...Array.from({ length: total }, (_, k) => h('span', { class: k < i ? 'dot on' : k === i ? 'dot cur' : 'dot' })));
    };
    const submit = () => {
      const raw = input.value.trim().replace('−', '-');
      if (!raw) return;
      ctx.touch();
      if (Number(raw) === prob.answer) {
        i++;
        input.value = '';
        if (i >= total) {
          render();
          ctx.solved();
          return;
        }
        prob = probs[i];
        render();
      } else {
        ctx.mistake();
        shake(input);
        input.select();
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    root.append(dots, expr, input);
    render();
    return {
      activate: () => input.focus({ preventScroll: true }),
      snapshot: () => ({ i }),
    };
  },
};
