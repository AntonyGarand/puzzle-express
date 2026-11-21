import { helpButton } from '../core/help';
import { L, locale, P } from '../core/i18n';
import { CATEGORIES, type CategoryId } from '../core/categories';
import { allSaves, clearSave, type Save } from '../core/saves';
import { encodeCode, resolveCode } from '../core/share';
import { prefs, stats } from '../core/store';
import { LEVELS, LEVEL_NAMES, type PuzzleDef } from '../core/types';
import { fmtTime, h } from '../core/ui';

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return L('just now', 'à l’instant');
  if (m < 60) return L(`${m}m ago`, `il y a ${m} min`);
  const hrs = Math.round(m / 60);
  return hrs < 24 ? L(`${hrs}h ago`, `il y a ${hrs} h`) : L(`${Math.round(hrs / 24)}d ago`, `il y a ${Math.round(hrs / 24)} j`);
};

let filter: CategoryId | 'all' = 'all';

/** Games tab: every game grouped by category; resume the unfinished one or start new at a chosen level. */
export function renderLabs(el: HTMLElement, defs: PuzzleDef[], codeError?: { input: string; error: string }) {
  // Saves of word games made in the other language can't be resumed here.
  const saves = Object.fromEntries(
    Object.entries(allSaves()).filter(([id, sv]) => !defs.find((d) => d.id === id)?.localized || (sv.locale ?? 'en') === locale()),
  );
  const rerender = () => renderLabs(el, defs);

  const tile = (d: PuzzleDef, save: Save | undefined) => {
    const st = stats(d.id);
    const pr = prefs(d.id);
    const levelSel = h(
      'select',
      { class: 'select', 'aria-label': `${d.name} — ${L('level', 'niveau')}` },
      ...LEVELS.map((l) => h('option', { value: String(l) }, LEVEL_NAMES[l])),
    );
    levelSel.value = String(save?.level ?? pr.level);
    const best = st.best[pr.level];
    const startNew = () => (location.hash = `#/game/${d.id}/new/${levelSel.value}`);

    return h(
      'article',
      { class: `lab-tile ${save ? 'has-save' : ''}`, 'data-puzzle': d.id },
      h(
        'header',
        null,
        h('div', { class: 'title-row' }, h('h2', null, d.name), helpButton(d)),
        save ? h('span', { class: 'badge' }, L('In progress', 'En cours')) : null,
      ),
      h('p', { class: 'rules' }, d.rules),
      save
        ? h(
            'p',
            { class: 'lab-meta' },
            `${LEVEL_NAMES[save.level]} · ${fmtTime(save.elapsed)} · ${ago(save.at)} · `,
            h(
              'button',
              {
                type: 'button',
                class: 'linkish',
                onclick: () => {
                  clearSave(d.id);
                  rerender();
                },
              },
              L('discard', 'abandonner'),
            ),
          )
        : h(
            'p',
            { class: 'lab-meta' },
            P(st.solved, ['solved', 'solved'], ['réussi', 'réussis']),
            best != null ? ` · ${L('best', 'record')} ${fmtTime(best)}` : '',
            ` · ${pr.manual ? '' : 'auto '}${LEVEL_NAMES[pr.level]}`,
          ),
      h(
        'div',
        { class: 'lab-new' },
        save ? h('a', { class: 'btn primary', href: `#/game/${d.id}` }, L('Resume', 'Reprendre')) : null,
        levelSel,
        h(
          'button',
          { type: 'button', class: `btn ${save ? '' : 'primary'}`, onclick: startNew },
          save ? L('New', 'Nouvelle') : L('Play', 'Jouer'),
        ),
        h(
          'a',
          {
            class: 'btn ghost endless',
            href: `#/play/${d.id}`,
            title: L(`Endless feed of ${d.name}`, `Fil sans fin : ${d.name}`),
            'aria-label': L(`Endless feed of ${d.name}`, `Fil sans fin : ${d.name}`),
          },
          '∞',
        ),
      ),
    );
  };

  // Play a puzzle someone shared: paste a code (or a whole link).
  const codeInput = h('input', {
    class: 'input inline',
    type: 'text',
    name: 'code',
    value: codeError?.input ?? '',
    placeholder: 'sudoku-3-1k2x9q',
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
    'aria-label': L('Puzzle code or link', 'Code ou lien de la partie'),
    'aria-describedby': 'code-msg',
  });
  const codeMsg = h(
    'p',
    { id: 'code-msg', class: `small code-msg ${codeError ? 'bad' : 'muted'}`, role: 'status' },
    codeError?.error ??
      L(
        'Someone sent you a puzzle code? Enter it to play that exact puzzle.',
        'On vous a envoyé un code de partie? Entrez-le pour jouer exactement la même partie.',
      ),
  );
  const codeForm = h(
    'form',
    {
      class: 'code-form',
      onsubmit: (e: SubmitEvent) => {
        e.preventDefault();
        const res = resolveCode(codeInput.value, defs);
        if ('error' in res) {
          codeMsg.textContent = res.error;
          codeMsg.className = 'small code-msg bad';
          codeInput.focus();
          return;
        }
        location.hash = `#/s/${encodeCode(res.code)}`;
      },
    },
    h('h3', null, L('Play a shared puzzle', 'Jouer une partie partagée')),
    h('div', { class: 'row' }, codeInput, h('button', { type: 'submit', class: 'btn primary' }, L('Play', 'Jouer'))),
    codeMsg,
  );

  const inProgress = defs.filter((d) => saves[d.id]).sort((a, b) => saves[b.id].at - saves[a.id].at);
  const cats = CATEGORIES.map((c) => ({ ...c, games: defs.filter((d) => d.category === c.id) })).filter((c) => c.games.length);
  const shown = filter === 'all' ? cats : cats.filter((c) => c.id === filter);

  const chip = (id: CategoryId | 'all', label: string, n: number) =>
    h(
      'button',
      {
        type: 'button',
        class: `chip-filter ${filter === id ? 'on' : ''}`,
        onclick: () => {
          filter = id;
          rerender();
        },
      },
      label,
      h('span', null, n),
    );

  el.replaceChildren(
    h(
      'div',
      { class: 'page wide' },
      h('h1', null, L('Games', 'Jeux')),
      h(
        'p',
        { class: 'muted' },
        L(
          `${defs.length} games. Pick any game and level — unfinished ones are saved automatically.`,
          `${defs.length} jeux. Choisissez un jeu et un niveau — les parties en cours sont sauvegardées automatiquement.`,
        ),
      ),
      codeForm,
      h(
        'div',
        { class: 'filters', role: 'toolbar', 'aria-label': L('Categories', 'Catégories') },
        chip('all', L('All', 'Tous'), defs.length),
        ...cats.map((c) => chip(c.id, c.name, c.games.length)),
      ),
      inProgress.length && filter === 'all'
        ? h(
            'section',
            { class: 'cat' },
            h('h3', null, L('Continue', 'Reprendre')),
            h('div', { class: 'lab-grid' }, ...inProgress.map((d) => tile(d, saves[d.id]))),
          )
        : null,
      ...shown.map((c) =>
        h(
          'section',
          { class: 'cat', id: `cat-${c.id}` },
          h('h3', null, c.name, h('span', { class: 'cat-blurb' }, c.blurb)),
          h('div', { class: 'lab-grid' }, ...c.games.map((d) => tile(d, saves[d.id]))),
        ),
      ),
    ),
  );
}
