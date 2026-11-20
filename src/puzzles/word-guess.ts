import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, shake } from '../core/ui';
import { better, keyboard, keyValue, type KeyState } from './wordkit/keyboard';
import { answers, dictReady, isWord, whenDict } from './wordkit/lexicon';
import './word-guess.css';

/** Per-letter feedback with correct handling of repeated letters. */
function score(guess: string, answer: string): KeyState[] {
  const res: KeyState[] = Array(guess.length).fill('out');
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit';
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] === 'hit') continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) { res[i] = 'near'; left.set(guess[i], n - 1); }
  }
  return res;
}

export const wordGuess: PuzzleDef = {
  id: 'word-guess',
  get name() { return L('Word Guess', 'Mot mystère'); },
  category: 'words',
  get rules() { return L('Guess the word. Green: right spot · yellow: elsewhere.', 'Trouvez le mot. Vert : bien placé · jaune : ailleurs.'); },
  localized: true,
  help: () => ({
    goal: L(
      'Find the hidden word before you run out of guesses.',
      'Trouvez le mot caché avant d’avoir épuisé vos essais.',
    ),
    steps: [
      L(
        'Type a real word of the right length and press Enter. Each row is one guess.',
        'Tapez un vrai mot de la bonne longueur, sans accents (É = E, Ç = C), puis appuyez sur Entrée. Chaque rangée est un essai.',
      ),
      L(
        'Green: right letter in the right spot. Yellow: the letter is in the word, but elsewhere. Grey: not in the word.',
        'Vert : bonne lettre au bon endroit. Jaune : la lettre est dans le mot, mais ailleurs. Gris : elle n’y est pas.',
      ),
      L('The keyboard keeps the best colour found for every letter.', 'Le clavier garde la meilleure couleur trouvée pour chaque lettre.'),
      L(
        'Use the on-screen keyboard or your own; ⌫ or Backspace erases a letter.',
        'Utilisez le clavier à l’écran ou le vôtre; ⌫ ou Retour arrière efface une lettre.',
      ),
      L(
        'Higher levels mean longer words (4 to 6 letters) and fewer guesses.',
        'Plus le niveau monte, plus le mot est long (4 à 6 lettres) et moins vous avez d’essais.',
      ),
    ],
    tips: [
      L('Open with a word full of common letters, like E, A, R, S and T.', 'Commencez par un mot plein de lettres courantes, comme E, A, S, R et T.'),
      L('Keep green letters in place and try yellow ones in new spots.', 'Gardez les lettres vertes en place et essayez les jaunes à d’autres endroits.'),
    ],
  }),
  par: (d) => byLevel(d, [60, 80, 110, 140, 180]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const len = byLevel(d, [4, 5, 5, 6, 6]);
    const max = byLevel(d, [7, 7, 6, 7, 6]);
    const answer = rng.pick(answers(len));

    let guesses: string[] = [];
    let cur = '';
    let over = false;

    const grid = board(len, max, 'wg');
    const cells = Array.from({ length: len * max }, () => {
      const el = h('div', { class: 'cell' });
      grid.append(el);
      return el;
    });
    const kb = keyboard((k) => press(k));

    const status = (msg?: string) => {
      if (msg) ctx.status(msg);
      else if (!dictReady()) ctx.status(L('loading words…', 'chargement des mots…'));
      else ctx.status(P(max - guesses.length, ['guess left', 'guesses left'], ['essai restant', 'essais restants']));
    };

    const render = () => {
      const states = new Map<string, KeyState>();
      for (let r = 0; r < max; r++) {
        const g = guesses[r];
        const fb = g ? score(g, answer) : null;
        const isCur = r === guesses.length && !over;
        for (let c = 0; c < len; c++) {
          const el = cells[r * len + c];
          const ch = g ? g[c] : isCur ? (cur[c] ?? '') : '';
          el.textContent = ch;
          el.className = `cell${fb ? ` wg-${fb[c]}` : isCur ? (ch ? ' wg-typed' : ' wg-cur') : ' wg-empty'}`;
          if (g && fb) states.set(g[c], better(states.get(g[c]), fb[c]));
        }
      }
      kb.paint(states);
    };

    const rowEl = () => grid; // shake the whole board (keeps cell classes clean for resume)
    const submit = () => {
      if (cur.length < len) { shake(rowEl()); status(L('Not enough letters', 'Pas assez de lettres')); return; }
      const ok = isWord(cur);
      if (ok === null) { status(L('loading words…', 'chargement des mots…')); return; }
      if (!ok) { shake(rowEl()); status(L('Not in word list', 'Mot inconnu')); return; }
      guesses.push(cur);
      cur = '';
      if (guesses[guesses.length - 1] === answer) {
        over = true;
        render();
        ctx.solved();
        return;
      }
      if (guesses.length >= max) {
        over = true;
        render();
        root.replaceChildren(grid, h('div', { class: 'wg-answer' }, h('span', { class: 'label' }, L('The word was', 'Le mot était')), board(len, 1, 'wg wg-reveal')));
        const rev = root.querySelector('.wg-reveal')!;
        for (const ch of answer) rev.append(h('div', { class: 'cell wg-hit' }, ch));
        ctx.failed();
        return;
      }
      render();
      status();
    };

    const press = (k: string) => {
      if (over) return;
      ctx.touch();
      if (k === 'enter') submit();
      else if (k === 'back') { cur = cur.slice(0, -1); render(); status(); }
      else if (cur.length < len) { cur += k; render(); }
    };

    const sv = ctx.saved as { g?: unknown; cur?: unknown } | undefined;
    if (sv && Array.isArray(sv.g)) {
      guesses = sv.g.filter((w): w is string => typeof w === 'string' && w.length === len && /^[a-z]+$/.test(w) && w !== answer).slice(0, max - 1);
      if (typeof sv.cur === 'string' && /^[a-z]*$/.test(sv.cur)) cur = sv.cur.slice(0, len);
    }

    root.append(grid, kb.el);
    render();
    status();
    whenDict(() => { if (!over) status(); });
    return {
      snapshot: () => ({ g: guesses, cur }),
      onKey(e) {
        const v = keyValue(e);
        if (!v) return false;
        press(v);
        return true;
      },
    };
  },
};
