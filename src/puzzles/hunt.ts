import { L, P } from '../core/i18n';
import { byLevel, type PuzzleDef } from '../core/types';
import { board, h, shake } from '../core/ui';
import { adjacent, findPath, makeGrid, points } from './wordkit/hunt-solver';
import { dictReady, isWord, letterKey, whenDict } from './wordkit/lexicon';
import './hunt.css';

export const hunt: PuzzleDef = {
  id: 'hunt',
  get name() {
    return L('Hunt', 'Chasse aux mots');
  },
  category: 'words',
  get rules() {
    return L('Drag through touching letters to spell words.', 'Glissez sur des lettres voisines pour former des mots.');
  },
  localized: true,
  help: () => ({
    goal: L(
      'Find words hidden in the letter grid until the bar reaches its points target.',
      'Trouvez les mots cachés dans la grille jusqu’à ce que la barre atteigne l’objectif de points.',
    ),
    steps: [
      L(
        'Drag through touching letters (sideways, up, down or diagonally) to spell a word, then let go to submit it.',
        'Glissez le doigt sur des lettres qui se touchent (côté, haut, bas ou diagonale) pour former un mot, puis relâchez pour le valider.',
      ),
      L(
        'Or tap the letters one by one, and tap the last one again to submit. Tap an earlier letter to back up.',
        'Ou touchez les lettres une à une, puis retouchez la dernière pour valider. Touchez une lettre précédente pour revenir en arrière.',
      ),
      L(
        'Each tile counts once per word. The minimum length is shown above the grid (3 or 4 letters).',
        'Chaque tuile ne sert qu’une fois par mot. La longueur minimale est affichée au-dessus de la grille (3 ou 4 lettres).',
      ),
      L(
        'Longer words score more: 3 letters = 1 pt, 4 = 2, 5 = 3, 6 = 5, 7 = 7, 8+ = 10.',
        'Les mots longs rapportent plus : 3 lettres = 1 pt, 4 = 2, 5 = 3, 6 = 5, 7 = 7, 8 et + = 10.',
      ),
      L(
        'Keyboard: type a word and press Enter; Backspace removes a letter, Escape clears.',
        'Clavier : tapez un mot (sans accents) et appuyez sur Entrée; Retour arrière retire une lettre, Échap efface tout.',
      ),
    ],
    tips: [
      L(
        'Once you find a word, try adding S, ED or ER to it.',
        'Un mot trouvé? Essayez-le au pluriel, au féminin ou conjugué : ils comptent aussi.',
      ),
      L('Scan for short common chunks like TH, ING or ER first.', 'Repérez d’abord les groupes courants comme ER, ON, QU ou ENT.'),
    ],
  }),
  par: (d) => byLevel(d, [60, 90, 150, 200, 260]),
  create(ctx) {
    const { root, rng, difficulty: d } = ctx;
    const n = byLevel(d, [4, 4, 4, 5, 5]);
    const minLen = byLevel(d, [3, 3, 3, 3, 4]);
    const frac = byLevel(d, [0.3, 0.4, 0.5, 0.4, 0.45]);
    const grid0 = makeGrid(rng, n, minLen, byLevel(d, [40, 40, 45, 100, 85]));
    const letters = grid0.letters;
    const target = Math.max(8, Math.round(grid0.pts * frac));

    const found: string[] = [];
    let path: number[] = [];
    let score = 0;
    let won = false;

    const word = h('div', { class: 'hunt-word' });
    const fill = h('div', { class: 'hunt-fill' });
    const bar = h('div', { class: 'hunt-bar' }, fill);
    const foundEl = h('div', { class: 'hunt-found' });
    const grid = board(n, n, 'hunt-grid');
    const cells = letters.map((ch, i) => {
      const el = h('div', { class: 'cell', 'data-i': i }, ch);
      grid.append(el);
      return el;
    });

    let msg = '';
    let msgTimer = 0;
    const say = (m: string) => {
      msg = m;
      clearTimeout(msgTimer);
      msgTimer = window.setTimeout(() => {
        msg = '';
        renderWord();
      }, 1100);
      renderWord();
    };
    const renderWord = () => {
      const w = path.map((i) => letters[i]).join('');
      word.textContent =
        w || msg || (dictReady() ? L(`${minLen}+ letters`, `${minLen} lettres et +`) : L('loading words…', 'chargement des mots…'));
      word.classList.toggle('typing', !!w);
    };
    const render = () => {
      cells.forEach((el, i) => {
        const k = path.indexOf(i);
        el.className = `cell${k >= 0 ? (k === path.length - 1 ? ' sel' : ' on') : ''}`;
      });
      renderWord();
      const pct = Math.min(100, Math.round((score / target) * 100));
      fill.style.width = `${pct}%`;
      bar.setAttribute('data-label', `${score} / ${target}`);
      foundEl.replaceChildren(...[...found].reverse().map((w) => h('span', null, w)));
      ctx.status(`${P(found.length, ['word', 'words'], ['mot', 'mots'])} · ${score}/${target} pts`);
    };

    const submit = () => {
      const w = path.map((i) => letters[i]).join('');
      path = [];
      if (!w) return render();
      if (w.length < minLen) {
        render();
        if (w.length > 1) {
          shake(word);
          say(L('Too short', 'Trop court'));
        }
        return;
      }
      if (found.includes(w)) {
        render();
        shake(word);
        say(L('Already found', 'Déjà trouvé'));
        return;
      }
      const ok = isWord(w);
      if (ok === null) {
        render();
        say(L('loading words…', 'chargement des mots…'));
        return;
      }
      if (!ok) {
        render();
        shake(word);
        say(L('Not a word', 'Mot inconnu'));
        return;
      }
      found.push(w);
      score += points(w.length);
      render();
      say(`+${points(w.length)} ${w}`);
      if (score >= target && !won) {
        won = true;
        ctx.solved();
      }
    };

    // Pointer: drag to trace (release submits); or tap cells one by one and tap the last again to submit.
    let dragging = false;
    let moved = false;
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const c = el?.closest<HTMLElement>('[data-i]');
      if (!c || !grid.contains(c)) return -1;
      const r = c.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2),
        dy = y - (r.top + r.height / 2);
      // only count the inner part of a cell so diagonal drags don't clip neighbours
      return dx * dx + dy * dy <= (r.width * 0.42) ** 2 ? Number(c.dataset.i) : -1;
    };
    const extend = (i: number) => {
      if (i < 0) return false;
      const lastI = path[path.length - 1];
      if (i === lastI) return false;
      if (path.length >= 2 && i === path[path.length - 2]) {
        path.pop();
        return true;
      } // back up
      if (path.includes(i) || (path.length && !adjacent(n, lastI, i))) return false;
      path.push(i);
      return true;
    };
    grid.addEventListener('pointerdown', (e) => {
      if (won) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (!el) return;
      const i = Number(el.dataset.i);
      ctx.touch();
      e.preventDefault();
      dragging = true;
      moved = false;
      if (path.length && i === path[path.length - 1]) {
        dragging = false;
        submit();
        return;
      }
      const k = path.indexOf(i);
      if (k >= 0) path = path.slice(0, k + 1);
      else if (!(path.length && adjacent(n, path[path.length - 1], i))) path = [i];
      else path.push(i);
      render();
    });
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      if (extend(cellAt(e.clientX, e.clientY))) {
        moved = true;
        render();
      }
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (moved && path.length > 1) submit();
    };
    grid.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const sv = ctx.saved as { f?: unknown; p?: unknown } | undefined;
    if (sv && Array.isArray(sv.f)) {
      for (const w of sv.f) {
        if (typeof w !== 'string' || !/^[a-z]+$/.test(w) || w.length < minLen || found.includes(w)) continue;
        if (score + points(w.length) >= target) break; // never resume already solved
        found.push(w);
        score += points(w.length);
      }
      if (Array.isArray(sv.p)) {
        const p: number[] = [];
        for (const i of sv.p) {
          if (typeof i !== 'number' || i < 0 || i >= n * n || p.includes(i) || (p.length && !adjacent(n, p[p.length - 1], i))) break;
          p.push(i);
        }
        path = p;
      }
    }

    root.append(h('div', { class: 'hunt-top' }, word, bar), grid, foundEl);
    render();
    whenDict(() => renderWord());

    let typed = '';
    return {
      snapshot: () => ({ f: found, p: path }),
      onKey(e) {
        if (won) return false;
        if (e.key === 'Enter') {
          typed = '';
          submit();
          return true;
        }
        if (e.key === 'Escape') {
          typed = '';
          path = [];
          render();
          return true;
        }
        if (e.key === 'Backspace') {
          typed = path
            .map((i) => letters[i])
            .join('')
            .slice(0, -1);
          path = findPath(letters, n, typed) ?? [];
          render();
          return true;
        }
        const ch = letterKey(e.key);
        if (ch) {
          typed = path.map((i) => letters[i]).join('') + ch;
          const p = findPath(letters, n, typed);
          if (p) {
            path = p;
            render();
          } else shake(grid);
          return true;
        }
        return false;
      },
      destroy() {
        clearTimeout(msgTimer);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      },
    };
  },
};
