import { L, locale } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, shake } from '../core/ui';
import { answers, commonOfLength, isWord, letterKey } from './wordkit/lexicon';
import { ANAGRAMS, anagramKey, WORDS } from './words';

export const anagram: PuzzleDef = {
  id: 'anagram',
  get name() {
    return L('Anagram', 'Anagramme');
  },
  category: 'words',
  get rules() {
    return L('Unscramble the word. Tap the letters or type.', 'Remettez les lettres dans l’ordre. Touchez ou tapez.');
  },
  localized: true,
  help: () => ({
    goal: L('Rearrange the scrambled letters to spell a word.', 'Replacez les lettres mélangées dans le bon ordre pour former un mot.'),
    steps: [
      L('The word gets longer with the level: from 4 letters up to 8.', 'Le mot s’allonge avec le niveau : de 4 à 8 lettres.'),
      L(
        'Tap the tiles in order to fill the slots. The word is checked as soon as every slot is full.',
        'Touchez les tuiles dans l’ordre pour remplir les cases. Le mot est vérifié dès que toutes les cases sont pleines.',
      ),
      L(
        'Tap a filled slot to take back that letter and the ones after it.',
        'Touchez une case remplie pour retirer cette lettre et celles qui la suivent.',
      ),
      L(
        'A wrong word shakes, counts as a mistake and clears the slots.',
        'Un mauvais mot fait trembler les cases, compte comme une erreur et les vide.',
      ),
      L(
        'Keyboard: type the letters; Backspace removes the last one, Escape clears. Shuffle mixes the tiles again.',
        'Clavier : tapez les lettres (sans accents, É = E); Retour arrière retire la dernière, Échap vide tout. « Mélanger » brasse les tuiles.',
      ),
    ],
    tips: [
      L(
        'Look for common endings such as -ING, -ER or -TION, and build from there.',
        'Repérez les terminaisons courantes comme -ER, -EUR ou -TION, puis complétez le début.',
      ),
      L('Stuck? Shuffle: a new order often makes the word jump out.', 'Bloqué? Mélangez : un nouvel ordre fait souvent apparaître le mot.'),
    ],
  }),
  par: (d) => byLevel(d, [15, 25, 40, 60, 90]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const len = byLevel(d, [4, 5, 6, 7, 8]);
    const fr = locale() === 'fr';
    const word = rng.pick(fr ? answers(len) : WORDS[len]);
    const key = anagramKey(word);
    // French: any common word with the same letters (and, once loaded, any dictionary word) also counts.
    const valid = fr ? new Set(commonOfLength(len).filter((w) => anagramKey(w) === key)) : ANAGRAMS.get(key)!;
    const accepts = (g: string) => valid.has(g) || (fr && isWord(g) === true);
    let letters = [...word];
    do rng.shuffle(letters);
    while (valid.has(letters.join('')));

    // picked[k] = index into `letters`
    let picked: number[] = [];
    const slots = h('div', { class: 'slots', style: `--len:${len}` });
    const tiles = h('div', { class: 'slots tiles', style: `--len:${len}` });

    const render = () => {
      slots.replaceChildren(
        ...Array.from({ length: len }, (_, k) =>
          h(
            'button',
            { type: 'button', class: `cell slot ${picked[k] != null ? 'filled' : ''}`, onclick: () => unpick(k) },
            picked[k] != null ? letters[picked[k]] : '',
          ),
        ),
      );
      tiles.replaceChildren(
        ...letters.map((ch, i) =>
          h('button', { type: 'button', class: `cell ${picked.includes(i) ? 'used' : ''}`, onclick: () => pick(i) }, ch),
        ),
      );
    };
    const check = () => {
      if (picked.length < len) return;
      const guess = picked.map((i) => letters[i]).join('');
      if (accepts(guess)) ctx.solved();
      else {
        ctx.mistake();
        shake(slots);
        setTimeout(() => {
          picked = [];
          render();
        }, 350);
      }
    };
    const pick = (i: number) => {
      if (picked.includes(i) || picked.length >= len) return;
      ctx.touch();
      picked.push(i);
      render();
      check();
    };
    const unpick = (k: number) => {
      if (k >= picked.length) return;
      picked = picked.slice(0, k);
      render();
    };
    const reshuffle = () => {
      const chosen = picked.map((i) => letters[i]);
      rng.shuffle(letters);
      // re-map picked letters onto the new order
      const used = new Set<number>();
      picked = chosen.map((ch) => {
        const i = letters.findIndex((l, j) => l === ch && !used.has(j));
        used.add(i);
        return i;
      });
      render();
    };
    ctx.controls(btn(L('Shuffle', 'Mélanger'), reshuffle, 'ghost'));
    const sv = ctx.saved as { letters?: string[]; picked?: number[] } | undefined;
    if (sv?.letters && [...sv.letters].sort().join('') === [...word].sort().join('')) {
      letters = sv.letters;
      picked = (sv.picked ?? []).filter((i) => i >= 0 && i < len);
    }
    root.append(slots, tiles);
    render();
    return {
      snapshot: () => ({ letters, picked }),
      onKey(e) {
        if (e.key === 'Backspace') {
          unpick(picked.length - 1);
          return true;
        }
        if (e.key === 'Escape') {
          picked = [];
          render();
          return true;
        }
        const ch = letterKey(e.key);
        if (ch) {
          const i = letters.findIndex((l, j) => l === ch && !picked.includes(j));
          if (i >= 0) pick(i);
          else shake(tiles);
          return true;
        }
        return false;
      },
    };
  },
};
