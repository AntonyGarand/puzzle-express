import { helpButton } from './help';
import { L, locale, P } from './i18n';
import { Rng } from './rng';
import { clearSave, putSave, type Save } from './saves';
import { prefs, record, setLevel, getProfile } from './store';
import { LEVELS, LEVEL_NAMES, type Difficulty, type PuzzleDef, type PuzzleInstance } from './types';
import { btn, fmtTime, h } from './ui';

export interface CardOptions {
  /** Labs mode: fixed levels (doesn't touch feed prefs), no auto-advance, "New puzzle" instead of "Next". */
  lab?: boolean;
  /** Start at this level instead of the puzzle's current level. */
  level?: Difficulty;
  /** Resume this saved puzzle on first mount. */
  resume?: Save;
}

interface Launch {
  level?: Difficulty;
  resume?: Save;
}

export class Card {
  readonly el: HTMLElement;
  private stage!: HTMLElement;
  private foot!: HTMLElement;
  private statusEl!: HTMLElement;
  private controlsEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private levelSel!: HTMLSelectElement;
  private inst: PuzzleInstance = {};

  level: Difficulty = 1;
  mounted = false;
  done = false;
  interacted = false;
  private active = false;
  private elapsed = 0;
  private runningSince = 0;
  private mistakes = 0;
  private gen = 0;
  private seed = 0;
  private saveTimer = 0;
  private launch: Launch | null;

  constructor(
    readonly def: PuzzleDef,
    private readonly onNext: (card: Card) => void,
    private readonly opts: CardOptions = {},
  ) {
    this.launch = { level: opts.level, resume: opts.resume };
    this.el = h('article', { class: 'card', 'data-puzzle': def.id });
    (this.el as HTMLElement & { card?: Card }).card = this;
    this.build();
  }

  /** Not yet started: safe to regenerate or drop. */
  get pristine() {
    return !this.done && !this.interacted && this.time() < 1500;
  }

  private build() {
    this.levelSel = h(
      'select',
      { class: 'level', title: L('Difficulty', 'Difficulté'), onchange: () => this.onLevelPick() },
      this.opts.lab ? null : h('option', { value: 'auto' }, L('Auto', 'Auto')),
      ...LEVELS.map((l) => h('option', { value: String(l) }, LEVEL_NAMES[l])),
    );
    this.timerEl = h('span', { class: 'timer' }, '0:00');
    this.stage = h('div', { class: 'stage' });
    this.statusEl = h('span', { class: 'status' });
    this.controlsEl = h('div', { class: 'controls' });
    this.foot = h('footer', { class: 'card-foot' });
    this.el.replaceChildren(
      h(
        'header',
        { class: 'card-head' },
        h(
          'div',
          { class: 'title' },
          h('div', { class: 'title-row' }, h('h2', null, this.def.name), this.makeHelpButton()),
          h('p', { class: 'rules' }, this.def.rules),
        ),
        h('div', { class: 'meta' }, this.levelSel, this.timerEl),
      ),
      this.stage,
      this.foot,
    );
  }

  private makeHelpButton() {
    let wasActive = false;
    return helpButton(this.def, {
      onOpen: () => {
        // Pause the clock while reading the tutorial.
        wasActive = this.active && !this.done;
        if (wasActive) this.setActive(false);
      },
      onClose: () => {
        if (wasActive) this.setActive(true);
      },
    });
  }

  private syncLevelSel() {
    if (this.opts.lab) {
      this.levelSel.value = String(this.level);
      return;
    }
    const p = prefs(this.def.id);
    const auto = this.levelSel.options[0];
    auto.textContent = p.manual ? L('Auto', 'Auto') : `${LEVEL_NAMES[this.level]} · auto`;
    this.levelSel.value = p.manual ? String(this.level) : 'auto';
  }

  private onLevelPick() {
    const v = this.levelSel.value;
    if (this.opts.lab) {
      this.mount({ level: Number(v) as Difficulty });
      return;
    }
    setLevel(this.def.id, v === 'auto' ? 'auto' : (Number(v) as Difficulty));
    // The feed regenerates pristine cards on level change; force it for this one too.
    this.mount();
  }

  mount(launch: Launch | null = this.launch) {
    this.launch = null; // the launch options only apply to the first mount
    this.gen++;
    const gen = this.gen;
    this.inst.destroy?.();
    this.inst = {};
    // Word games generate from the locale's word list: a save from the other language can't be resumed.
    const resume = launch?.resume && (!this.def.localized || (launch.resume.locale ?? 'en') === locale()) ? launch.resume : undefined;
    this.level = resume?.level ?? launch?.level ?? (this.opts.lab && this.mounted ? this.level : prefs(this.def.id).level);
    this.seed = resume?.seed ?? (Math.random() * 2 ** 32) >>> 0;
    this.mounted = true;
    this.done = false;
    this.interacted = !!resume;
    this.mistakes = resume?.mistakes ?? 0;
    this.elapsed = resume?.elapsed ?? 0;
    this.runningSince = this.active ? performance.now() : 0;
    this.el.classList.remove('is-solved', 'is-failed', 'is-skipped');
    this.stage.replaceChildren();
    this.stage.inert = false;
    this.statusEl.textContent = '';
    this.controlsEl.replaceChildren();
    this.foot.replaceChildren(
      this.statusEl,
      h(
        'div',
        { class: 'actions' },
        this.controlsEl,
        btn(
          this.opts.lab ? L('Give up', 'Abandonner') : L('Skip', 'Passer'),
          () => this.finish(this.opts.lab ? 'failed' : 'skipped'),
          'ghost',
        ),
      ),
    );
    this.syncLevelSel();
    this.tick();

    const live = () => gen === this.gen && !this.done;
    const root = h('div', { class: 'puzzle' });
    this.stage.append(root);
    this.inst =
      this.def.create({
        difficulty: this.level,
        rng: new Rng(this.seed),
        root,
        saved: resume?.state,
        solved: () => live() && this.finish('solved'),
        failed: () => live() && this.finish('failed'),
        mistake: () => {
          if (live()) this.mistakes++;
        },
        touch: () => {
          if (live()) this.interacted = true;
        },
        status: (t) => {
          if (gen === this.gen) this.statusEl.textContent = t;
        },
        controls: (...els) => {
          if (gen === this.gen) this.controlsEl.append(...els);
        },
      }) || {};
    // Any pointer interaction inside the stage counts as starting; progress is saved shortly after.
    root.addEventListener('pointerdown', () => (this.interacted = true), { capture: true });
    root.addEventListener('pointerup', () => this.queueSave());
    root.addEventListener('keyup', () => this.queueSave());
    if (this.active) this.inst.activate?.();
  }

  /** Re-sync the level label without regenerating (e.g. auto→manual elsewhere). */
  refreshLevelLabel() {
    this.syncLevelSel();
  }

  private queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), 400);
  }

  /** Save in-progress state so it can be resumed from Labs. */
  persist() {
    clearTimeout(this.saveTimer);
    if (!this.mounted || this.done || !this.interacted) return;
    let state: unknown;
    try {
      state = this.inst.snapshot?.();
    } catch {
      state = undefined;
    }
    putSave(this.def.id, {
      seed: this.seed,
      level: this.level,
      elapsed: Math.round(this.time()),
      mistakes: this.mistakes,
      state,
      at: Date.now(),
      locale: locale(),
    });
  }

  time() {
    return this.elapsed + (this.runningSince ? performance.now() - this.runningSince : 0);
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!this.mounted) this.mount();
    if (on && !this.done) {
      this.runningSince = performance.now();
      this.inst.activate?.();
    } else if (!on) {
      this.persist();
      if (this.runningSince) this.elapsed += performance.now() - this.runningSince;
      this.runningSince = 0;
      // Don't let a focused input keep swallowing keys meant for the next card.
      const f = document.activeElement as HTMLElement | null;
      if (f && this.el.contains(f)) f.blur();
    }
  }

  tick() {
    this.timerEl.textContent = fmtTime(this.time());
  }

  onKey(e: KeyboardEvent): boolean {
    if (this.done) return false;
    const handled = this.inst.onKey?.(e) ?? false;
    if (handled) {
      this.interacted = true;
      this.queueSave();
    }
    return handled;
  }

  private finish(o: 'solved' | 'failed' | 'skipped') {
    if (this.done) return;
    const ms = Math.round(this.time());
    this.done = true;
    clearSave(this.def.id, this.seed);
    this.setActive(false);
    this.active = true; // still the visible card; just stop the clock
    this.stage.inert = true;
    this.el.classList.add(`is-${o}`);
    this.tick();

    const res = record(this.def.id, { d: this.level, o, ms, m: this.mistakes }, this.def.par(this.level) * 1000);

    const parts: (string | HTMLElement)[] = [];
    if (o === 'solved') parts.push(h('strong', { class: 'good' }, L('Solved', 'Réussi')), ` ${L('in', 'en')} ${fmtTime(ms)}`);
    else if (o === 'failed') parts.push(h('strong', { class: 'bad' }, L('Not this time', 'Pas cette fois')));
    else parts.push(h('strong', null, L('Skipped', 'Passé')));
    if (this.mistakes && o !== 'skipped') parts.push(` · ${P(this.mistakes, ['mistake', 'mistakes'], ['erreur', 'erreurs'])}`);
    if (res.best) parts.push(` · ${L('new best', 'nouveau record')}`);
    if (res.levelChange) {
      const up = res.levelChange.to > res.levelChange.from;
      parts.push(
        h(
          'span',
          { class: 'lvl-change' },
          ` · ${up ? L('Level up', 'Niveau supérieur') : L('Easing off', 'On ralentit')} → ${LEVEL_NAMES[res.levelChange.to]}`,
        ),
      );
    }

    this.foot.replaceChildren(
      h('span', { class: 'status result' }, ...parts),
      h(
        'div',
        { class: 'actions' },
        this.opts.lab ? null : btn(L('Again', 'Rejouer'), () => this.mount(), 'ghost'),
        btn(this.opts.lab ? L('New puzzle', 'Nouvelle partie') : L('Next ↓', 'Suivant ↓'), () => this.onNext(this), 'primary'),
      ),
    );

    if (this.opts.lab) return;
    if (o === 'solved' && getProfile().autoAdvance) {
      const gen = this.gen;
      setTimeout(() => gen === this.gen && this.onNext(this), 1400);
    } else if (o === 'skipped') {
      this.onNext(this);
    }
  }

  destroy() {
    this.persist();
    this.inst.destroy?.();
    this.gen++;
  }
}
