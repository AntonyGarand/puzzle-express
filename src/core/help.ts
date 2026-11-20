import { L } from './i18n';
import type { PuzzleDef } from './types';
import { h } from './ui';

const SEEN_KEY = 'puzzle-express:help-seen';

function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
const helpSeen = (id: string) => seenSet().has(id);
function markSeen(id: string) {
  const s = seenSet();
  s.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

let dialog: HTMLDialogElement | null = null;

/** Show the how-to-play dialog for a game. */
function openHelp(def: PuzzleDef, onClose?: () => void) {
  markSeen(def.id);
  dialog?.remove();
  const help = def.help?.();
  const close = () => {
    dlg.close();
  };
  const dlg = h(
    'dialog',
    { class: 'help', 'data-puzzle': def.id, 'aria-labelledby': 'help-title' },
    h(
      'div',
      { class: 'help-head' },
      h('h2', { id: 'help-title' }, def.name),
      h('button', { type: 'button', class: 'btn ghost help-x', 'aria-label': L('Close', 'Fermer'), onclick: close }, '✕'),
    ),
    h('p', { class: 'help-goal' }, help?.goal ?? def.rules),
    help?.steps.length
      ? h(
          'section',
          null,
          h('h3', null, L('How to play', 'Comment jouer')),
          h('ol', { class: 'help-steps' }, ...help.steps.map((s) => h('li', null, s))),
        )
      : null,
    help?.tips?.length
      ? h('section', null, h('h3', null, L('Tips', 'Astuces')), h('ul', { class: 'help-tips' }, ...help.tips.map((s) => h('li', null, s))))
      : null,
    h(
      'p',
      { class: 'help-levels muted small' },
      L(
        'Five levels, Easy to Master. On Auto, the level rises when you solve quickly and cleanly.',
        'Cinq niveaux, de Facile à Maître. En mode Auto, le niveau monte quand vous résolvez vite et sans faute.',
      ),
    ),
    h('div', { class: 'help-foot' }, h('button', { type: 'button', class: 'btn primary', onclick: close }, L('Got it', 'Compris'))),
  );
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close(); // click on the backdrop
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (dialog === dlg) dialog = null;
    onClose?.();
  });
  document.body.append(dlg);
  dialog = dlg;
  dlg.showModal();
}

/** The "?" button used on cards and game tiles. `big` shows a "How to play" label for unseen games. */
export function helpButton(def: PuzzleDef, opts: { onOpen?: () => void; onClose?: () => void } = {}) {
  const fresh = !helpSeen(def.id);
  const b = h(
    'button',
    {
      type: 'button',
      class: `help-btn ${fresh ? 'fresh' : ''}`,
      title: L('How to play', 'Comment jouer'),
      'aria-label': `${L('How to play', 'Comment jouer')}: ${def.name}`,
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        opts.onOpen?.();
        openHelp(def, () => {
          b.classList.remove('fresh');
          b.replaceChildren('?');
          opts.onClose?.();
        });
      },
    },
    fresh ? `? ${L('How to play', 'Comment jouer')}` : '?',
  );
  return b;
}
