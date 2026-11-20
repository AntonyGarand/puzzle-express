export type CategoryId = 'logic' | 'paths' | 'numbers' | 'words' | 'moves' | 'cards' | 'memory';

import { L } from './i18n';

export interface Category {
  id: CategoryId;
  readonly name: string;
  readonly blurb: string;
}

/** Display order of categories on the Games tab and in Settings. */
export const CATEGORIES: Category[] = [
  { id: 'logic', get name() { return L('Logic', 'Logique'); }, get blurb() { return L('Grids with rules — deduce every cell.', 'Des grilles et des règles — déduisez chaque case.'); } },
  { id: 'paths', get name() { return L('Paths & links', 'Chemins et liens'); }, get blurb() { return L('Connect, trace and untangle.', 'Reliez, tracez et démêlez.'); } },
  { id: 'numbers', get name() { return L('Numbers', 'Chiffres'); }, get blurb() { return L('Arithmetic, codes and merging.', 'Calcul, codes et fusions.'); } },
  { id: 'words', get name() { return L('Words', 'Mots'); }, get blurb() { return L('Spell, guess and unscramble.', 'Épelez, devinez et démêlez.'); } },
  { id: 'moves', get name() { return L('Moves', 'Déplacements'); }, get blurb() { return L('Slide, push and clear the board.', 'Glissez, poussez et videz le plateau.'); } },
  { id: 'cards', get name() { return L('Cards & chess', 'Cartes et échecs'); }, get blurb() { return L('Solitaires and tactics.', 'Patiences et tactique.'); } },
  { id: 'memory', get name() { return L('Memory & eyes', "Mémoire et coup d'œil"); }, get blurb() { return L('Remember and spot.', 'Retenez et repérez.'); } },
];
