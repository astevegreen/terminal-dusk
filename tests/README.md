# Cross-package test suites

Suites here play whole games, so they need several packages at once (engine, content and the AI as a player).
Each package's own unit tests live inside that package instead.

- `fuzz/` - fuzz suites, run by `pnpm fuzz:quick` (1,000 games) and `pnpm fuzz` (10,000 games, in CI).
  Each suite reads how many games to play from the `FUZZ_GAMES` environment variable.
- `golden/` - golden replays: saved games that must reproduce exactly. `pnpm golden:check` runs them;
  `pnpm golden:update` re-records them, and only for an intended rules change.

Both are ordinary Vitest files (`*.test.ts`). `tools/gates/suites.mjs` type-checks this folder with `tsconfig.json`,
then runs the suites. There are no suites yet: the first ones arrive with the engine.
