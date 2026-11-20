# Agent notes

- Read `README.md` (commands, layout) and `docs/ADDING_GAMES.md` (game contract, i18n, tutorials) before changing code.
- `npm run check` must pass before committing. Run `npm run fmt` after editing; don't hand-format.
- One game per `src/puzzles/<id>.ts`; shared engines go in a `src/puzzles/<name>kit/` folder. Don't add a registry entry: games are auto-discovered.
- All randomness comes from `ctx.rng` (resume regenerates from the seed). All user-visible text goes through `L(en, fr)`, written in Québec French with "vous".
- Static site on GitHub Pages (puzzle.garand.dev). Don't introduce a backend or server hosting.
