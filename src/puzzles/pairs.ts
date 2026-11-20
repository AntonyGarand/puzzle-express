import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, PALETTE, s, shake } from '../core/ui';
import { anim, int, isIntArr } from './movekit/kit';
import './pairs.css';

const SHAPES = 9;
function shape(k: number, fill: string): SVGElement {
  const a = { fill, stroke: 'var(--ink)', 'stroke-width': 6, 'stroke-linejoin': 'round' };
  switch (k) {
    case 0:
      return s('circle', { ...a, cx: 50, cy: 50, r: 32 });
    case 1:
      return s('rect', { ...a, x: 20, y: 20, width: 60, height: 60, rx: 6 });
    case 2:
      return s('polygon', { ...a, points: '50,14 86,80 14,80' });
    case 3:
      return s('polygon', { ...a, points: '50,12 86,50 50,88 14,50' });
    case 4:
      return s('polygon', { ...a, points: '50,10 61,38 90,40 67,58 75,88 50,71 25,88 33,58 10,40 39,38' });
    case 5:
      return s('polygon', { ...a, points: '38,14 62,14 62,38 86,38 86,62 62,62 62,86 38,86 38,62 14,62 14,38 38,38' });
    case 6:
      return s('polygon', { ...a, points: '50,12 84,31 84,69 50,88 16,69 16,31' });
    case 7:
      return s('path', { ...a, 'fill-rule': 'evenodd', d: 'M50 16a34 34 0 1 0 0.01 0Z M50 36a14 14 0 1 1 -0.01 0Z' });
    default:
      return s('path', { ...a, d: 'M14 50 L50 14 L86 50 L68 50 L68 86 L32 86 L32 50 Z' });
  }
}
const symbol = (id: number) =>
  s('svg', { viewBox: '0 0 100 100', class: 'sym', 'aria-hidden': 'true' }, shape(id % SHAPES, PALETTE[Math.floor(id / SHAPES)]));

export const pairs: PuzzleDef = {
  id: 'pairs',
  get name() {
    return L('Pairs', 'Paires');
  },
  category: 'memory',
  get rules() {
    return L('Flip two cards at a time. Match every pair.', 'Retournez deux cartes à la fois. Formez toutes les paires.');
  },
  help: () => ({
    goal: L('Find every matching pair of symbols hidden under the cards.', 'Trouvez toutes les paires de symboles cachés sous les cartes.'),
    steps: [
      L('Tap a card to flip it, then tap a second one.', 'Touchez une carte pour la retourner, puis une deuxième.'),
      L('If the two symbols match, the pair stays face up.', 'Si les deux symboles sont identiques, la paire reste visible.'),
      L(
        'If not, both stay shown until you tap another card, then flip back.',
        'Sinon, les deux restent visibles jusqu’à ce que vous touchiez une autre carte, puis se retournent.',
      ),
      L(
        'Each pair of flips is one try. Missing a match you had already seen counts as a mistake.',
        'Chaque paire de cartes retournées compte pour un essai. Rater une paire déjà vue compte comme une erreur.',
      ),
      L(
        'On Master you have 40 tries; run out and the game is lost.',
        'En Maître, vous avez 40 essais; une fois épuisés, la partie est perdue.',
      ),
    ],
    tips: [
      L(
        'Flip unknown cards first and remember where each symbol was.',
        'Retournez d’abord les cartes inconnues et retenez l’emplacement de chaque symbole.',
      ),
      L(
        'On harder levels, symbols differ only by colour or shape: look closely.',
        'Aux niveaux plus difficiles, les symboles ne diffèrent que par la couleur ou la forme : regardez bien.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [25, 45, 70, 120, 170]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const [cols, rows] = byLevel<[number, number]>(d, [
      [4, 3],
      [4, 4],
      [5, 4],
      [6, 5],
      [6, 6],
    ]);
    const n = cols * rows;
    const np = n / 2;
    const limit = byLevel(d, [0, 0, 0, 0, 40]);

    // Symbols: easy levels use clearly different shapes and colours; harder ones mix similar ones.
    let syms: number[];
    if (np <= SHAPES && d <= 2) {
      const sh = rng.shuffle([...Array(SHAPES).keys()]);
      const co = rng.shuffle([...Array(8).keys()]);
      syms = Array.from({ length: np }, (_, i) => co[i % 8] * SHAPES + sh[i]);
    } else {
      syms = rng.shuffle([...Array(SHAPES * 8).keys()]).slice(0, np);
    }
    const deck = rng.shuffle([...syms, ...syms]);
    const partner = deck.map((v, i) => deck.findIndex((w, j) => j !== i && w === v));

    let matched = new Array<boolean>(n).fill(false);
    let seen = new Array<boolean>(n).fill(false);
    let open: number[] = [];
    let tries = 0;
    let over = false;

    const sv = ctx.saved as { m?: unknown; seen?: unknown; open?: unknown; tries?: unknown } | undefined;
    const bits = (v: unknown) => (isIntArr(v, n) ? v.map((x) => x === 1) : null);
    const m0 = bits(sv?.m),
      s0 = bits(sv?.seen);
    if (m0 && s0) {
      matched = m0;
      seen = s0;
      if (isIntArr(sv?.open) && sv.open.length <= 2 && sv.open.every((i) => i >= 0 && i < n && !matched[i])) open = [...new Set(sv.open)];
      tries = Math.max(0, int(sv?.tries, 0));
    }

    const grid = board(cols, rows, 'pairs-grid');
    const els = deck.map((_, i) => {
      const el = h('button', { type: 'button', class: 'cell', 'aria-label': L(`card ${i + 1}`, `carte ${i + 1}`), onclick: () => tap(i) });
      grid.append(el);
      return el;
    });
    const shown = new Array<boolean>(n).fill(false);
    const render = () => {
      els.forEach((el, i) => {
        const up = matched[i] || open.includes(i) || over;
        el.className = `cell pc ${up ? 'up' : ''} ${matched[i] ? 'on' : ''} ${over && !matched[i] ? 'miss' : ''}`
          .replace(/\s+/g, ' ')
          .trim();
        if (up !== shown[i]) {
          el.replaceChildren(...(up ? [symbol(deck[i])] : []));
          shown[i] = up;
        }
      });
      const found = matched.filter(Boolean).length / 2;
      const left = limit - tries;
      ctx.status(
        `${L('Pairs', 'Paires')} ${found}/${np} · ${
          limit
            ? L(`${left} ${left === 1 ? 'try' : 'tries'} left`, `${left} ${left < 2 ? 'essai restant' : 'essais restants'}`)
            : P(tries, ['try', 'tries'], ['essai', 'essais'])
        }`,
      );
    };

    const tap = (i: number) => {
      if (over || matched[i]) return;
      if (open.length === 2) {
        const was = open;
        open = [];
        if (was.includes(i)) {
          render();
          return;
        }
      }
      if (open.includes(i)) return;
      ctx.touch();
      open.push(i);
      if (open.length === 2) {
        const [a, b] = open;
        tries++;
        if (deck[a] === deck[b]) {
          matched[a] = matched[b] = true;
          open = [];
        } else if (seen[partner[a]] || seen[b]) {
          ctx.mistake();
        }
        seen[a] = seen[b] = true;
        render();
        if (deck[a] === deck[b]) {
          anim(els[a], FLASH, 260);
          anim(els[b], FLASH, 260);
        } else anim(els[i], FLIP, 180);
        if (matched.every(Boolean)) {
          over = true;
          ctx.solved();
          return;
        }
        if (limit && tries >= limit) {
          over = true;
          open = [];
          render();
          shake(grid);
          ctx.failed();
        }
        return;
      }
      seen[i] = true;
      render();
      anim(els[i], FLIP, 180);
    };

    root.append(grid);
    render();
    return {
      snapshot: () => ({ m: matched.map(Number), seen: seen.map(Number), open, tries }),
    };
  },
};

const FLIP: Keyframe[] = [{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' }];
const FLASH: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }];
