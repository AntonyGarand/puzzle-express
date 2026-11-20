# puzzle express

An endless, scroll-snapping feed of short puzzles. It's a static site with no backend: your profile, stats and preferences live in `localStorage`.

```sh
npm install
npm run dev     # local dev server
npm test        # generator, resume round-trip and auto-levelling tests
npm run audit   # plays puzzles in Chrome against a running dev server
npm run shots   # screenshots of every puzzle into shots/
npm run build   # static output in dist/
```

## Games

There are 45 games in seven categories (`src/core/categories.ts`):

- **Logic:** Sudoku, Jigsaw Sudoku, Killer Sudoku, Cross Sums, Unequal, Binary, Queens, Stars, Tents, Tiles, Mines, Bridges, Nonogram, Lights, Code Breaker
- **Paths & links:** Pipes, Connect, Beehive, Tracks, Untangle, Maze
- **Numbers:** Quick Math, Sequence, Target, Guess, Merge
- **Words:** Anagram, Word Guess, Hunt, Tower
- **Moves:** Slide, Unblock, Push, Gems, Arrange, Blocks, Flood
- **Cards & chess:** Solitaire, FreeCell, Spider, Pyramid, Chess (mate in 1 or 2)
- **Memory & eyes:** Memory, Pairs, Odd Shade

Every game is generated from a seed and has five levels: Easy, Medium, Hard, Expert, Master. Shared helpers live in `src/puzzles/*kit/` folders. The word games validate against a lazily loaded dictionary (`src/puzzles/wordkit/dict.txt`, built from SCOWL via `wordlist-english` by `wordkit/build-dict.mjs`).

## Navigation

- **Feed**: an endless mixed feed. `#/play/<id>` gives an endless feed of a single puzzle.
- **Games**: every game grouped by category; pick any puzzle and level. Unfinished puzzles from the feed or Labs are saved, with their seed, board state and time, so you can resume them here.
- **Profile**: your stats, plus export, import and reset.
- **Settings**: theme, auto-advance, starting level, and how often each puzzle appears and at what level.

On phones, the tabs move to a bottom bar.

## Difficulty

Each puzzle type starts on **Auto**:

- **Up a level** after 3 clean solves within par time, or 2 flawless solves in under half of par.
- **Down a level** after 2 misses in a row, where a miss is a failure or a skip.

If you pick a level yourself (on the card or in Settings), it's locked and auto-levelling stops for that puzzle. Choose *Auto* to turn it back on.

## Adding a puzzle

See [docs/ADDING_GAMES.md](docs/ADDING_GAMES.md). Any `src/puzzles/<id>.ts` that exports a `PuzzleDef` is registered automatically. Use the shared building blocks from `src/core/ui.ts` (`board`, `.cell`, `pad`, `btn`, `PALETTE`) so the new puzzle matches the rest. Implement `snapshot()` and read `ctx.saved` so the puzzle can be resumed. Generate everything from `ctx.rng`, because resuming re-creates the puzzle from its seed.
