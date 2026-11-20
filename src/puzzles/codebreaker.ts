import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { btn, h, PALETTE, shake } from '../core/ui';

export const codebreaker: PuzzleDef = {
  id: 'codebreaker',
  get name() { return L('Code Breaker', 'Casse-code'); },
  category: 'logic',
  get rules() { return L('Crack the code. ● right spot · ○ wrong spot.', 'Trouvez le code. ● bien placée · ○ mal placée.'); },
  help: () => ({
    goal: L(
      'Find the hidden colour code before you run out of guesses.',
      'Trouvez le code de couleurs secret avant d’épuiser vos essais.',
    ),
    steps: [
      L('Tap colours in the palette to fill the current row (or press 1, 2, 3…).', 'Touchez les couleurs de la palette pour remplir la rangée en cours (ou appuyez sur 1, 2, 3…).'),
      L('⌫ removes the last colour (Backspace). Guess submits a full row (Enter).', '⌫ retire la dernière couleur (Retour arrière). Essayer soumet une rangée complète (Entrée).'),
      L('Each ● is a right colour in the right spot; each ○ a right colour in the wrong spot. They don’t say which peg.', 'Chaque ● est une bonne couleur bien placée; chaque ○, une bonne couleur mal placée. Ils ne disent pas laquelle.'),
      L('Up to Medium, each colour appears at most once. From Hard on, colours can repeat.', 'Jusqu’au niveau Moyen, chaque couleur apparaît au plus une fois. Dès Difficile, elles peuvent se répéter.'),
      L('Run out of rows and the code is revealed.', 'Si vous manquez de rangées, le code est révélé.'),
    ],
    tips: [
      L('Use your first guesses to learn which colours are in the code.', 'Servez-vous des premiers essais pour savoir quelles couleurs sont dans le code.'),
      L('Change one thing at a time and watch how the feedback shifts.', 'Changez une chose à la fois et observez comment les indices évoluent.'),
    ],
  }),
  par: (d) => byLevel(d, [40, 60, 90, 120, 160]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const len = byLevel(d, [3, 4, 4, 5, 5]);
    const colors = byLevel(d, [4, 5, 6, 6, 7]);
    const maxGuesses = byLevel(d, [8, 8, 8, 9, 9]);
    const dupes = d >= 3;
    const pool = [...Array(colors).keys()];
    const code = dupes ? Array.from({ length: len }, () => rng.int(0, colors - 1)) : rng.shuffle(pool).slice(0, len);

    const guesses: { g: number[]; exact: number; near: number }[] = [];
    let cur: number[] = [];

    const board = h('div', { class: 'code-board', style: `--len:${len}` });
    const palette = h('div', { class: 'pad' });
    for (let c = 0; c < colors; c++) {
      palette.append(h('button', { type: 'button', class: 'key swatch', style: `--c:${PALETTE[c]}`, 'aria-label': L(`colour ${c + 1}`, `couleur ${c + 1}`), onclick: () => add(c) }));
    }

    const peg = (c: number | undefined) => h('span', { class: `peg ${c == null ? 'empty' : ''}`, style: c == null ? '' : `--c:${PALETTE[c]}` });
    const render = () => {
      const rows: HTMLElement[] = [];
      for (let r = 0; r < maxGuesses; r++) {
        const past = guesses[r];
        const isCur = r === guesses.length;
        const pegs = Array.from({ length: len }, (_, k) => peg(past ? past.g[k] : isCur ? cur[k] : undefined));
        const fb = h('span', { class: 'fb' });
        if (past) {
          for (let k = 0; k < past.exact; k++) fb.append(h('i', { class: 'exact' }));
          for (let k = 0; k < past.near; k++) fb.append(h('i', { class: 'near' }));
        }
        rows.push(h('div', { class: `code-row ${isCur ? 'cur' : ''} ${past || isCur ? '' : 'future'}` }, h('span', { class: 'pegs' }, ...pegs), fb));
      }
      board.replaceChildren(...rows);
      ctx.status(P(maxGuesses - guesses.length, ['guess left', 'guesses left'], ['essai restant', 'essais restants']));
    };
    const add = (c: number) => {
      if (cur.length >= len) return;
      if (!dupes && cur.includes(c)) { shake(board.children[guesses.length]); return; }
      ctx.touch();
      cur.push(c);
      render();
    };
    const back = () => { cur.pop(); render(); };
    const submit = () => {
      if (cur.length < len) { shake(board.children[guesses.length]); return; }
      let exact = 0;
      const rc: number[] = [], rg: number[] = [];
      cur.forEach((c, k) => (c === code[k] ? exact++ : (rc.push(code[k]), rg.push(c))));
      let near = 0;
      for (const c of rg) { const j = rc.indexOf(c); if (j >= 0) { near++; rc.splice(j, 1); } }
      guesses.push({ g: cur, exact, near });
      cur = [];
      render();
      if (exact === len) ctx.solved();
      else if (guesses.length >= maxGuesses) {
        board.append(h('div', { class: 'code-row reveal' }, h('span', { class: 'pegs' }, ...code.map((c) => peg(c))), h('span', { class: 'fb' }, 'code')));
        ctx.failed();
      }
    };
    ctx.controls(btn('⌫', back, 'ghost'), btn(L('Guess', 'Essayer'), submit, 'primary'));
    const sv = ctx.saved as { guesses?: typeof guesses; cur?: number[] } | undefined;
    if (Array.isArray(sv?.guesses)) {
      guesses.push(...sv.guesses.slice(0, maxGuesses - 1));
      cur = sv.cur ?? [];
    }
    root.append(board, palette);
    render();
    return {
      snapshot: () => ({ guesses, cur }),
      onKey(e) {
        const n = Number(e.key);
        if (n >= 1 && n <= colors) { add(n - 1); return true; }
        if (e.key === 'Backspace') { back(); return true; }
        if (e.key === 'Enter') { submit(); return true; }
        return false;
      },
    };
  },
};
