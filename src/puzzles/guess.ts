import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import './guess.css';

/** Bulls & cows score of a guess against the secret (both distinct digits). */
export function scoreGuess(secret: number[], g: number[]) {
  let exact = 0,
    near = 0;
  g.forEach((v, k) => {
    if (secret[k] === v) exact++;
    else if (secret.includes(v)) near++;
  });
  return { exact, near };
}

export const guess: PuzzleDef = {
  id: 'guess',
  get name() {
    return L('Guess', 'Code secret');
  },
  category: 'numbers',
  get rules() {
    return L('Crack the digit code. ● right spot · ○ wrong spot.', 'Trouvez le code. ● bonne place · ○ mauvaise place.');
  },
  help: () => ({
    goal: L(
      'Find the secret code: a row of different digits in a set order. After each guess, dots tell you how close you are.',
      'Trouvez le code secret : une suite de chiffres tous différents, dans un ordre précis. Après chaque essai, des pastilles indiquent si vous chauffez.',
    ),
    steps: [
      L(
        'Tap digits (or type them) to fill the row. Tap a digit again to remove it; ⌫ or Backspace erases the last one.',
        'Touchez des chiffres (ou tapez-les) pour remplir la rangée. Touchez un chiffre de nouveau pour le retirer; ⌫ ou Retour arrière efface le dernier.',
      ),
      L('Press Guess (or Enter) to submit the row.', 'Appuyez sur Essayer (ou Entrée) pour soumettre la rangée.'),
      L(
        '● means a digit is in the right spot; ○ means it’s in the code but elsewhere. The dots don’t say which digit.',
        '● : un chiffre est à la bonne place; ○ : il est dans le code, mais ailleurs. Les pastilles ne disent pas lequel.',
      ),
      L('A digit never appears twice in the code.', 'Un chiffre n’apparaît jamais deux fois dans le code.'),
      L('Guesses are limited; run out and the code is revealed.', 'Les essais sont limités; une fois épuisés, le code est dévoilé.'),
    ],
    tips: [
      L(
        'Start with guesses that share no digits to find out which ones are in the code.',
        'Commencez par des essais sans chiffre commun pour savoir lesquels font partie du code.',
      ),
      L(
        'Then shuffle the right digits around to pin down their positions.',
        'Ensuite, déplacez les bons chiffres pour trouver leur position.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [40, 60, 100, 140, 200]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const len = byLevel(d, [3, 3, 4, 4, 5]);
    const poolSize = byLevel(d, [6, 8, 10, 10, 10]);
    const maxGuesses = byLevel(d, [8, 8, 9, 8, 10]);
    const pool = poolSize === 10 ? [...Array(10).keys()] : Array.from({ length: poolSize }, (_, i) => i + 1);
    const secret = rng.shuffle([...pool]).slice(0, len);

    const guesses: { g: number[]; exact: number; near: number }[] = [];
    let cur: number[] = [];
    let over = false;

    const boardEl = h('div', { class: 'code-board guess-board', style: `--len:${len}` });
    const keyEls = new Map<number, HTMLButtonElement>();
    const rows: number[][] = poolSize > 6 ? [pool.slice(0, Math.ceil(pool.length / 2)), pool.slice(Math.ceil(pool.length / 2))] : [pool];
    const pads = rows.map((r) => {
      const p = h('div', { class: 'pad' });
      for (const v of r) {
        const k = h('button', { type: 'button', class: 'key', onclick: () => add(v) }, String(v));
        keyEls.set(v, k);
        p.append(k);
      }
      return p;
    });

    const digit = (v: number | undefined, cls = '') =>
      h('span', { class: `gd ${v == null ? 'empty' : ''} ${cls}`.trim() }, v == null ? '' : String(v));
    const render = () => {
      const out: HTMLElement[] = [];
      for (let r = 0; r < maxGuesses; r++) {
        const past = guesses[r];
        const isCur = r === guesses.length && !over;
        const ds = Array.from({ length: len }, (_, k) => digit(past ? past.g[k] : isCur ? cur[k] : undefined));
        const fb = h('span', { class: 'fb' });
        if (past) {
          for (let k = 0; k < past.exact; k++) fb.append(h('i', { class: 'exact' }));
          for (let k = 0; k < past.near; k++) fb.append(h('i', { class: 'near' }));
        }
        out.push(
          h('div', { class: `code-row ${isCur ? 'cur' : ''} ${past || isCur ? '' : 'future'}` }, h('span', { class: 'digits' }, ...ds), fb),
        );
      }
      if (over && guesses[guesses.length - 1]?.exact !== len) {
        out.push(
          h(
            'div',
            { class: 'code-row reveal' },
            h('span', { class: 'digits' }, ...secret.map((v) => digit(v, 'secret'))),
            h('span', { class: 'fb' }, L('code', 'code')),
          ),
        );
      }
      boardEl.replaceChildren(...out);
      keyEls.forEach((k, v) => k.classList.toggle('sel', cur.includes(v)));
      ctx.status(over ? '' : P(maxGuesses - guesses.length, ['guess left', 'guesses left'], ['essai restant', 'essais restants']));
    };
    const curRow = () => boardEl.children[guesses.length] ?? boardEl;
    const add = (v: number) => {
      if (over) return;
      ctx.touch();
      if (cur.includes(v)) cur = cur.filter((x) => x !== v); // tap again to take it back
      else if (cur.length >= len) {
        shake(curRow());
        return;
      } else cur.push(v);
      render();
    };
    const back = () => {
      if (over || !cur.length) return;
      cur.pop();
      render();
    };
    const submit = () => {
      if (over) return;
      if (cur.length < len) {
        shake(curRow());
        return;
      }
      ctx.touch();
      const res = scoreGuess(secret, cur);
      guesses.push({ g: cur, ...res });
      cur = [];
      if (res.exact === len) {
        over = true;
        render();
        ctx.solved();
        return;
      }
      if (guesses.length >= maxGuesses) {
        over = true;
        render();
        ctx.failed();
        return;
      }
      render();
    };

    const sv = ctx.saved as { guesses?: unknown; cur?: unknown } | undefined;
    const okDigits = (g: unknown, full: boolean): g is number[] =>
      Array.isArray(g) && (full ? g.length === len : g.length <= len) && g.every((v) => pool.includes(v)) && new Set(g).size === g.length;
    if (Array.isArray(sv?.guesses)) {
      for (const x of sv.guesses.slice(0, maxGuesses - 1)) {
        const g = (x as { g?: unknown })?.g;
        if (!okDigits(g, true)) break;
        const res = scoreGuess(secret, g);
        if (res.exact === len) break;
        guesses.push({ g: g.slice(), ...res });
      }
      if (okDigits(sv?.cur, false)) cur = sv.cur.slice();
    }

    const del = btn('⌫', back, 'ghost');
    del.setAttribute('aria-label', L('Delete', 'Effacer'));
    del.title = L('Delete', 'Effacer');
    ctx.controls(del, btn(L('Guess', 'Essayer'), submit, 'primary'));
    root.append(boardEl, ...pads);
    render();
    return {
      snapshot: () => ({ guesses, cur }),
      onKey(e) {
        if (/^[0-9]$/.test(e.key)) {
          const v = Number(e.key);
          if (pool.includes(v)) add(v);
          return true;
        }
        if (e.key === 'Backspace') {
          back();
          return true;
        }
        if (e.key === 'Enter') {
          submit();
          return true;
        }
        return false;
      },
    };
  },
};
