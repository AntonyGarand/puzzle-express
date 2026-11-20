import './chess.css';
import { L } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, shake } from '../core/ui';
import { apply, bestDefence, forcesMate2, from, generate, isMate, legal, sqName, to, type Board } from './chesskit/chess';

const GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'].map((g) => (g ? g + '\uFE0E' : ''));

export const chess: PuzzleDef = {
  id: 'chess',
  get name() {
    return L('Chess', 'Échecs');
  },
  category: 'cards',
  get rules() {
    return L('White to move. Find the only mating line.', 'Aux blancs de jouer. Trouvez l’unique suite qui mate.');
  },
  help: () => ({
    goal: L(
      'You play White. Checkmate the black king in the number of moves shown: mate in 1 on Easy and Medium, mate in 2 from Hard up.',
      'Vous jouez les blancs. Faites échec et mat au roi noir dans le nombre de coups indiqué : mat en 1 en Facile et Moyen, mat en 2 à partir de Difficile.',
    ),
    steps: [
      L('Tap one of your white pieces: its legal squares light up.', 'Touchez une de vos pièces blanches : ses cases permises s’allument.'),
      L(
        'Tap a highlighted square to play the move. Tap another white piece to switch, or press Escape to cancel.',
        'Touchez une case en surbrillance pour jouer le coup. Touchez une autre pièce blanche pour changer, ou appuyez sur Échap pour annuler.',
      ),
      L(
        'In a mate in 2, Black replies automatically with the toughest defence, shown in the status line. Then find the final mate.',
        'Dans un mat en 2, les noirs répondent automatiquement avec la meilleure défense, affichée sous le plateau. Trouvez ensuite le mat final.',
      ),
      L(
        'A move that doesn’t lead to mate counts as a mistake and is taken back: try again.',
        'Un coup qui ne mène pas au mat compte comme une erreur et est annulé : réessayez.',
      ),
      L(
        'No castling or en passant here; a pawn reaching the last rank always becomes a queen.',
        'Ni roque ni prise en passant ici; un pion qui atteint la dernière rangée devient toujours une dame.',
      ),
    ],
    tips: [
      L(
        'Look at the squares around the black king: which ones are already covered?',
        'Observez les cases autour du roi noir : lesquelles sont déjà contrôlées?',
      ),
      L(
        'Checks are tempting, but in a mate in 2 the key move is often a quiet one.',
        'Les échecs sont tentants, mais dans un mat en 2, le coup clé est souvent un coup tranquille.',
      ),
    ],
  }),
  par: (d) => byLevel(d, [30, 45, 90, 120, 150]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const puzzle = generate(rng, d);
    const start = Int8Array.from(puzzle.board) as Board;

    let moves: number[] = [];
    let sel = -1;
    let over = false;

    const replay = (ms: number[]) => ms.reduce((b, m) => apply(b, m), start);
    const sv = ctx.saved as { moves?: unknown; sel?: unknown } | undefined;
    if (sv && Array.isArray(sv.moves) && sv.moves.every((m) => typeof m === 'number')) {
      // replay defensively: each white move must be legal
      let b = start;
      const ok: number[] = [];
      for (const m of sv.moves as number[]) {
        const white = ok.length % 2 === 0;
        if (!legal(b, white).includes(m)) break;
        ok.push(m);
        b = apply(b, m);
      }
      if (ok.length % 2 === 0 && ok.length < puzzle.mateIn * 2 - 1) moves = ok;
      if (typeof sv.sel === 'number' && sv.sel >= 0 && sv.sel < 64 && b[sv.sel] > 0) sel = sv.sel;
    }

    let cur = replay(moves);
    const grid = board(8, 8, 'chess');
    const cells: HTMLButtonElement[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const el = h('button', { type: 'button', class: 'cell', 'aria-label': sqName(sq), onclick: () => tap(sq) });
      cells.push(el);
      grid.append(el);
    }

    const left = () => puzzle.mateIn - moves.length / 2;
    const status = (t?: string) => ctx.status(t ?? L(`Mate in ${left()} · White to move`, `Mat en ${left()} · Aux blancs de jouer`));

    const render = () => {
      const targets = new Set(
        sel >= 0
          ? legal(cur, true)
              .filter((m) => from(m) === sel)
              .map(to)
          : [],
      );
      const last = moves.length ? moves[moves.length - 1] : -1;
      cells.forEach((el, sq) => {
        const dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
        const p = cur[sq];
        let cls = 'cell';
        if (dark) cls += ' dk';
        if (sq === sel) cls += ' sel';
        if (targets.has(sq)) cls += p ? ' tgt cap' : ' tgt';
        if (last >= 0 && (sq === from(last) || sq === to(last))) cls += ' last';
        el.className = cls;
        el.replaceChildren(p ? h('span', { class: p > 0 ? 'pw' : 'pb' }, GLYPH[Math.abs(p)]) : '');
      });
    };

    const wrong = (msg: string) => {
      ctx.mistake();
      shake(grid);
      sel = -1;
      render();
      status(msg);
    };

    const tap = (sq: number) => {
      if (over) return;
      ctx.touch();
      if (cur[sq] > 0 && sq !== sel) {
        sel = sq;
        render();
        return;
      }
      if (sel < 0) return;
      const m = legal(cur, true).find((mv) => from(mv) === sel && to(mv) === sq);
      if (m == null) {
        sel = -1;
        render();
        return;
      }
      const nb = apply(cur, m);
      if (left() === 2) {
        if (!forcesMate2(cur, m)) {
          wrong(L('Black escapes · Try again', 'Les noirs s’échappent · Réessayez'));
          return;
        }
        const reply = bestDefence(nb);
        moves.push(m, reply);
        cur = apply(nb, reply);
        sel = -1;
        render();
        status(
          L(
            `Black ${sqName(from(reply))}→${sqName(to(reply))} · Mate in 1`,
            `Noirs ${sqName(from(reply))}→${sqName(to(reply))} · Mat en 1`,
          ),
        );
        return;
      }
      if (!isMate(nb, false)) {
        wrong(L('Not mate · Try again', 'Pas mat · Réessayez'));
        return;
      }
      moves.push(m);
      cur = nb;
      sel = -1;
      over = true;
      render();
      status(L('Checkmate!', 'Échec et mat!'));
      ctx.solved();
    };

    root.append(grid);
    render();
    if (moves.length) {
      const r = moves[moves.length - 1];
      status(L(`Black ${sqName(from(r))}→${sqName(to(r))} · Mate in 1`, `Noirs ${sqName(from(r))}→${sqName(to(r))} · Mat en 1`));
    } else status();

    return {
      snapshot: () => ({ moves, sel }),
      onKey(e) {
        if (e.key === 'Escape' && sel >= 0) {
          sel = -1;
          render();
          return true;
        }
        return false;
      },
    };
  },
};
