# Terminal Dusk

Two-player, card-driven strategy game (1990-2027) in a TypeScript monorepo.
The owner is not a programmer: explain every change in plain English, and prove it with tests.

## Commands
- `pnpm gate` - full local check of changed packages; prints failures only; must pass before you finish
- `pnpm test --filter <package>` - unit tests for one package
- `pnpm fuzz:quick` - 1,000 random games (CI runs 10,000 with `pnpm fuzz`)
- `pnpm content:check` - validate all cards and scenarios against the schemas
- `pnpm golden:update` - re-record golden replays; only for an intended rules change
- `pnpm replay <matchId>` - turn a reported game into a test fixture
- `pnpm dev` - run the web app locally

## Map
- `packages/engine` pure rules engine; `packages/content` cards, map, scenarios, schemas
- `packages/host` MatchHost; `packages/ai` AI opponent; `packages/app` React UI, transports, Platform
- `packages/server` Supabase functions and SQL; `shells/` Electron and Capacitor; `tools/` scripts, hooks, gates
- File index: `docs/repo-map.md` (generated). Read it instead of listing folders.
- Game rules: `docs/design/`. Architecture decisions 1-8: `docs/architecture.md`.

## Hard rules (each is checked; a failing check means your change is wrong, not the check)
1. `packages/engine` imports nothing outside itself: no React, DOM, network, Date, Math.random or timers. (boundary check)
2. Only engine and host code use `GameState`. UI uses frames; AI uses views plus `reconstruct`. (boundary check)
3. Every state field lives in exactly one compartment: public, private[side] or secret. (fuzz invariant)
4. Every wait for a player is a pending Decision. Never await input inside rules.
5. State is plain JSON, integers only, explicit ordering; `apply` never mutates its input. (fuzz, frozen inputs)
6. Cards are data checked by the schemas. A `builtin` only when no step type can express the card.
7. Only the server `submit` function writes game state. Clients never write match tables.
8. Platform-specific code lives only in Platform implementations.
9. A new DecisionKind or EventKind needs its UI prompt or presentation entry. (type check)

## How to work
- Read the task's "Read first" files. Use the Explore agent for anything else; don't read whole folders.
- Write failing tests from the acceptance criteria first, then the code.
- Keep files under about 350 lines; split by responsibility.
- Stay inside the task's scope. Mention other problems in your summary instead of fixing them.
- No new dependency without a reason in your summary.
- If the spec is unclear, contradicts docs/architecture.md, or needs a game-design choice: stop and ask.
  In a night run, comment the question on the issue and label it `blocked`. Never invent game rules.

## Never
- Weaken, skip or delete a test to get green, or change gate scripts, test configs or hooks to pass.
- Edit `.claude/`, `CLAUDE.md`, `GEMINI.md`, `.github/`, `docs/architecture.md`, `tools/hooks/` or `tools/gates/`
  unless the owner asked for it in this session.
- Push to `main`, force-push, or rewrite history.
- Put secrets, the RNG seed or hidden cards anywhere a client, log or test snapshot can see them.
- Use names, art or text from Twilight Struggle, or likenesses of real people.

## Finishing
End every task with:
- **What changed** - the behaviour, in plain English, 2-5 bullets
- **Tests** - what now proves it
- **Unsure about** - anything the owner should check, or "nothing"
