# Adding a game

Each game is a `PuzzleDef` (see `src/core/types.ts`) in its own file, `src/puzzles/<id>.ts`. Any top-level module in `src/puzzles/` that exports a `PuzzleDef` is registered automatically, so there's no index to edit. Put helpers in a subfolder (`src/puzzles/<group>/…`) or in a module that doesn't export a `PuzzleDef`.

Read these first:

- `src/core/types.ts`: `PuzzleDef`, `PuzzleCtx`, `PuzzleInstance`, `byLevel`
- `src/core/ui.ts`: `h` / `s` (DOM/SVG builders), `board()`, `btn()`, `pad()`, `shake()`, `PALETTE`
- `src/core/categories.ts`: category ids
- `src/styles.css`: shared classes (`.grid`, `.cell` and its states, `.pad`, `.key`, `.btn`, `.big`, `.dots`, `.input`) and tokens
- Example games: `sudoku.ts` (board, number pad, selection, keyboard), `pipes.ts` (SVG inside cells), `nonogram.ts` (drag painting with pointer events), `maze.ts` (canvas, drag/swipe), `codebreaker.ts` (rows of pegs, palette), `target.ts` (chips, undo/reset controls)

## Contract

- `create(ctx)` builds the game inside `ctx.root` and may return a `PuzzleInstance`.
- Call `ctx.touch()` on the first interaction. Call `ctx.mistake()` only for a genuinely wrong move. Call `ctx.solved()` or `ctx.failed()` once. Use `ctx.status(text)` for a short footer line (moves left, counts, …) and `ctx.controls(...buttons)` for extra footer buttons (Undo, mode toggles, …).
- **All randomness must come from `ctx.rng`.** Resuming re-creates the game from the same seed, so `Math.random` breaks resume.
- **Implement `snapshot()`** returning JSON-serialisable progress, and restore it defensively from `ctx.saved`. After a resume, the visible board (classes, text, inline styles) must be identical, including the current selection. `test/resume.test.ts` checks this automatically by clicking random buttons.
- A new puzzle must never start already solved.
- Validate by the rules, not by comparing with a stored solution, unless the generator guarantees a unique solution.
- Difficulty 1 to 5 (Easy, Medium, Hard, Expert, Master) must make a real difference: size, givens, constraints, move limits. `par(d)` is a realistic target solve time in seconds and drives auto-levelling.
- Generation must be fast: under about 300 ms typically, and never over 1500 ms at any level (tested with 15 seeds × 5 levels). Use node/attempt budgets with a fallback.
- `rules` is one line of 60 characters or fewer.
- Use generic genre names. Don't use trademarked game names, and don't copy another site's look, art or levels.

## Look & feel (neo-brutalist, shared everywhere)

- Use `board(cols, rows, extraClass)` and `.cell` for grids. Its width is `var(--board)`, so the game fits any screen. Keep total height within about `var(--board)` plus 120 px for pads and palettes.
- Reuse `.cell.on`, `.sel`, `.given`, `.err`, `.miss`, `.hint`, `.x`, plus `btn()`, `pad()`, `.key.swatch` with `--c:${PALETTE[i]}`, `.dots`, `.big` and `.input`. Don't invent new button or tile styles.
- Tokens: `--ink` (borders and shadows), `--bw` (border width), `--sh` (shadow offset), `--cell` / `--cell-alt` (surfaces), `--fg`, `--muted`, `--accent` (the game's tone), `--accent-soft`, `--on-tone` (text on bright fills), `--good`, `--bad`, `--p1`…`--p8` (palette), `--r`, `--r-cell`.
- For extra CSS, create `src/puzzles/<id>.css`, import it from the module (`import './<id>.css';`), and scope every rule under `[data-puzzle='<id>']`. Set the game's tone there: `[data-puzzle='<id>'] { --accent: var(--pN); }`.
- For drag interactions, use pointer events with `touch-action: none` on the drag surface. Don't use HTML5 drag-and-drop. The feed scrolls vertically, so swipes inside a game must not leak into it.
- Light and dark themes both come from the tokens. Never hard-code black or white; use `--ink`, `--cell` and `--on-tone`.

## Checking your work

```sh
npx tsc --noEmit -p .        # only errors in your own files matter
npx vitest run               # generation speed, not-solved-at-start, resume round-trip, registry
IDS=<id1>,<id2> LEVELS=1,3,5 node scripts/shots.mjs http://localhost:5180/ shots-<name>
```

The screenshot script writes contact sheets (`sheet-*.png`) into the output folder. Look at them.

## Languages (English + Québec French) and tutorials

- Every user-visible string goes through `L(en, fr)` from `src/core/i18n.ts`. For counts, use `P(n, ['move', 'moves'], ['coup', 'coups'])`. That covers the status line, buttons, labels, aria-labels, titles, messages and on-screen keyboards. The locale is fixed for the page's lifetime (switching reloads), so calling `L()` at render time is fine.
- `name` and `rules` must be getters so they follow the locale:
  ```ts
  get name() { return L('Pipes', 'Tuyaux'); },
  get rules() { return L('Rotate tiles until everything joins the source.', 'Tournez les tuiles pour tout relier à la source.'); },
  ```
  Both languages must stay at 60 characters or fewer.
- Write in Québec French: use "vous" and natural Québec usage. Follow OQLF typography: no space before `? ! ;`, a space before `:`, and « guillemets » if you need quotes. Card ranks are A, R, D, V; suits are pique, cœur, carreau, trèfle. Chess pieces are roi, dame, tour, fou, cavalier, pion.
- **Tutorial:** add `help: () => ({ goal, steps, tips })`, with every string in `L()`:
  - `goal`: one or two sentences on what you are trying to achieve.
  - `steps`: 3 to 6 short numbered steps covering the rules, then the controls (tap, drag, long-press, keyboard keys, footer buttons).
  - `tips`: 1 to 3 strategy hints for a beginner.

  It shows in a dialog behind the "?" next to the title. Keep it concrete, short and friendly, and make it match what the game actually does.
- Word games whose content depends on the language set `localized: true` and must generate from the current locale's word list.
