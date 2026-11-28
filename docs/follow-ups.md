# Follow-ups

Known work that a session found outside its task. The list carries it forward, so session summaries stop repeating
it. Sessions add to it by day; sprint lanes file follow-up issues instead. Moving an item into an issue deletes it here.

## How to use

- Grep this file before adding: an item already here gets nothing more.
- One item per bullet: what is wrong or missing, and where (`file:line`, an issue or pull request number), then
  the date found and how, in brackets.
- Finish an item: delete its bullet in the same commit.
- A design question goes to the owner as a question, not here.

## Rules engine and content

- The Hard AI wins 60% as LIO against Hard as SAE on the six-region map (60-38, 2 draws; `node tools/balance/run.mjs
--scenario six-region --lio-tier hard --sae-tier hard --games 50 --seed hh6r-<1..2>` at b9af85e), while Medium
  against Medium is 47%. Find what Hard does less well as SAE (`packages/ai/src/`), like #628 did for Unified
  command; the run's per-card tables and its tech race attempts (SAE 4, LIO 0 in 100 games) are a start.
  [27 Nov 2026, balance re-measure; owner kept the numbers]
- `docs/design/map-and-points.md` ("Map numbers", Open) still says the scenario data has not been changed to the
  21 Nov rules; the scenario is `packages/content/scenarios/base-game.json` since #575. Fix it at the next Notion
  promotion. [21 Nov 2026, #575]

## App, host and server

- The tutorial's real lesson needs live fill-in first: `docs/design/tutorial.md` ("Coaching words", approved) quotes
  points and places from the game, with variants (no Taiwan, the Rwandan Genocide sum, chapter 6's can't-pay line),
  and a step's `say` is fixed text (`packages/content/schema/tutorial.ts`). Add named slots in `say`, optional
  `variants: [{ if, say }]` from fixed name lists the schema checks, and a pure `packages/host/src/tutorial/fill.ts`
  reading frames only; then write the seven chapters word for word, `placeholder: false`, deckTop from "Cards dealt
  first", after #642, with a test comparing each filled line with the doc's. [27 Nov 2026, architect on #640]
- Test the tutorial's never-stuck rule inside a whole match (`packages/app/src/tutorial/tutorialMatch.ts` `neverStuck`):
  the placeholder lesson can't reach a step that refuses every legal answer. Once the real lesson exists, add a
  lesson fixture whose coach step allows only an unaffordable country or a card used as a type it lacks.
  [27 Nov 2026, agy on PR #661]
- Events that arrive in one frame start their sounds at the same instant
  (`packages/app/src/audio/useEventSounds.tsx` `playEventSounds`): once sound files exist, listen to a busy move and
  stagger or merge them. [27 Nov 2026, #645]
- The tutorial's coach box (`packages/app/src/tutorial/tutorial.css`, top 154px since #666, under the map's tools)
  has little height for the real lesson: a line of about 290 characters ends 30px into the decision banner at 667x375
  and 1px above it at 844x390. Fit the box when those words land. [27 Nov 2026, #666 layout probe]

- The online log marks a late side's `pointsSpent` and `cardsDiscarded` by the event's side alone
  (`packages/app/src/online/gameText.ts` `isMoveOf`), and a card's event can give both without an answer. If a card
  ever gives them inside that side's own stand-in run (rival-granted points, a random discard), the line reads
  "Played for X" although the stand-in chose nothing; no content card is known to discard that way today. [26 Nov
  2026, reviewer and agy on #633]
- `docs/design/core-loop.md` has a new "Missed deadlines" section (#611) with no Notion promotion entry in its header:
  record it at the next promotion. [22 Nov 2026, agy on #611]
- A game with no map has no era in its frame (`packages/engine/src/createGame.ts:84-92` sets it only with a map), so
  against the AI the free game says "Era not shown yet" for its whole length, and the base game until Era 2 starts.
  The app already names the frame's era where there is one (#669); the engine side is lane C's. [27 Nov 2026, #669]
- Account deletion isn't built (`docs/architecture.md`, "Accounts and purchases"). When it is, it deletes the
  player's `entitlement` rows and nulls `entitlement_chargeback.player` and `platform`
  (`packages/server/supabase/migrations/20261101000000_paddle_chargebacks.sql`) so a later chargeback reversal
  cannot give a deleted account a copy. It also clears a used gift code's `gift_code.redeemed_by` without making
  the code usable again: the table's check ties it to `redeemed_at`, so that check changes in a new migration (#710).
  [27 Nov 2026, #683, architect]
- The web client's `CHECKOUT_CODES` (`packages/app/src/platform/webPurchases.ts:20`) lacks `tooManyRequests`, so a
  checkout the server rate-limits (#735) shows "network" instead of its own message. Add the code and its text.
  [28 Nov 2026, reviewer on #735]
- `SupabaseCheckoutLimitStore.claim` has no direct test: add one that claims up to the limit and then is refused.
  [28 Nov 2026, agy on #735]
- ProfileView has no entry point in the app and no Playwright smoke test: link it from a screen and add a smoke test
  that opens it. [28 Nov 2026, reviewer on #728]
- `SupabaseSeekStore.open` doesn't page past 1,000 rows (Supabase's default response limit), so a longer seek table
  is read only in part: page the read. [28 Nov 2026, review of #737]
- Entitlement isn't rechecked when the matchmaker pairs two seeks (#737), so a player whose copy was refunded since
  they sought can still be paired: recheck both sides at pairing (#687). [28 Nov 2026, review of #737, #687]
- The stack tests don't exercise `SupabaseSeekStore.create` or `open` against the real tables: add a stack test for
  each. [28 Nov 2026, review of #737]
- No test covers the in-memory seek store's refusal of a duplicate seek, and its keying differs from the SQL's: test
  the refusal, then make the two key the same way. [28 Nov 2026, review of #738]
- A Paddle transaction can still be created after `priceTimedOut`: check `cancel.signal.aborted` before the ask, so a
  timed-out price lookup never ends in a charge the buyer didn't see. [28 Nov 2026, agy on #739]

## Tests and tooling

- The seek migration repeats one literal several times (SonarCloud on #737): name it once in the SQL. [28 Nov 2026,
  SonarCloud on #737]
- On a loaded PC a full `pnpm gate` fails on time-outs in tests the change does not touch: the 5 s limit in
  `packages/ai` (techRace, lookahead, medium's timing), the app's six-region map game and the easy AI fuzz, and the
  100 s engine fuzz (`tests/fuzz/engine.test.ts`). [27 Nov 2026, sound chain]
- Agents comment as astevegreen while greenbeanbot is suspended, so after the bot returns a `Blocked:` comment an
  agent posted as the owner can read as the owner's answer (`tools/sprint/rules.mjs:207` `ownerAnswer`): check blocked
  issues then, or mark agent comments so the queue stops relying on the author (7 Nov 2026, review of #540).
- `tools/gates/test-count.mjs:153-159` `heldByOwner` trusts a `held` label added by astevegreen, which agents now add
  too while gh is signed in as the owner, so a PR an agent held may drop tests (7 Nov 2026, review of #540).
- ci.yml's test-count job writes `$RUNNER_TEMP/pr-events.ndjson` (the `held` label history) before the pull
  request's own `pnpm install` runs, so an install script from the pull request could rewrite it before
  `tools/gates/test-count.mjs` reads it (#587 only covers the tests the script runs). Fetch the events after the
  install, or keep them where the pull request's code can't write. [21 Nov 2026, agy on #589]
- The two sister repos' copies of `tools/gemini/gemini-api.mjs` still lack the TLS handshake limit this repo's
  `postApi` gained in #608 (a tunnel that opens but carries nothing waits the full 10 minutes there); copy it, with
  its test in `gemini-proxy.test.mjs`, and the `PASS_ON` line in `tools/gemini/agy.mjs` that moves that reason on to
  the next model (tested in `agy-api.test.mjs`). [22 Nov 2026, Gemini API tunnel fix review]
- The fuzz suites that prove random play "reaches" a feature (`tests/fuzz/easy.test.ts:56`, `reveals.test.ts`,
  `removed.test.ts`, `neutral.test.ts`, `extraSteps.test.ts`) each replay their games again to count events. One
  coverage pass that plays each game once and feeds every counter would save the replays; not merged yet because
  each suite builds its games differently (rulesets, maps, choosers). [6 Nov 2026, test-suite audit]
- `packages/engine/src/views.property.test.ts` and `views.test.ts` overlap (both check what each viewer sees);
  consolidating them into one property suite with a few named examples would cut duplicate cases. [6 Nov 2026,
  test-suite audit]
- Planned: move the type check to TypeScript 7 (Microsoft's native compiler). Measured 6 Nov 2026: all six packages
  pass with no errors and the type check drops from 19.4s to 3.4s. It stays on 6.0 for now because typescript-eslint
  and `tools/gates/boundaries.mjs` need the compiler API that 7.0 lacks (`pnpm-workspace.yaml` catalog note).
  TypeScript 7.1 brings that API (beta 20 Oct 2026; stable reported for late November 2026). Once 7.1 is stable,
  check whether typescript-eslint supports it: if it does, move everything to 7.1 in one step; if not, run 7.x for
  `typecheck` only, beside 6.0 for lint and the boundary check. The Rust port tsrs was looked at and skipped: it
  is experimental and would save under a second here. [6 Nov 2026, owner's research request]
- Planned, after the TypeScript 7 move: replace ESLint with Oxlint (Rust; `oxlint` 1.92, stable since mid-2025).
  Measured 6 Nov 2026 on its default rules: about 0.1s for `packages/` and `tests/`, against 10.9s for
  `pnpm -r run lint` today. Its type-aware rules need TypeScript 7 (`oxlint-tsgolint`). `npx @oxlint/migrate`
  converts `eslint.config.js`; custom rules would need its JS plugins, still alpha; the output formatter
  `tools/eslint-formatter.mjs` and the gate's failure filter would need checking. [6 Nov 2026, owner's research request]
- Cloud sessions get HTTP 403 from GitHub's GraphQL API, and `tools/sprint/queue.mjs` still reads and writes through
  it: `loadSnapshot` (`:70`, `gh issue list` and `gh pr list`), so `next`, `status`, `digest` and `move` stop there
  before `move`'s REST writes; `statusFacts` (`:164`), `status --write` (`:320`) and `digest` (`:329`).
  `tools/github-rest.mjs` has the REST calls to start from. [27 Nov 2026, #665]
- With no REST route, `gh pr ready`, `gh pr merge --auto` (`tools/sprint/moves.mjs:174`) and `gh issue pin`
  (`tools/gemini-audit.mjs:152`) stay undone in a cloud session, which is told so; the CCR routes the 403 names could
  do them. [27 Nov 2026, #665]
- `tools/sprint/queue.mjs` is past 350 lines (358). [27 Nov 2026, #665]
- In a cloud session the Gemini API fallback (#529) reviews an ordinary `pr <n>`, but three audits still end in
  verdict `retry` there: the rail audit (`tools/gemini-audit.mjs:215-219`), a diff too long to send whole
  (`tools/gemini/gemini-api.mjs:60`), and spec and repo audits (`gemini-api.mjs:66`). Each is a choice the code comments explain;
  a PR touching a rail waits for a local run. [7 Nov 2026, reviewer on #538]
- `tools/github-rest.mjs` (`isDecisionComment`, `issue`) and `tools/github-trust.mjs` now decide whose comments
  override the spec agy reviews against, and neither is a rail (`tools/gemini/rails.mjs:11-21`), so loosening them
  gets no rail audit: add both. [27 Nov 2026, #672]
- agy's audit sends a linked issue's body as the spec whoever opened the issue (`tools/gemini-audit.mjs`
  `prMaterial`), unlike the sprint queue, which takes only issues `trustedIssue` passes: say so in the material, or
  leave a stranger's body out. [27 Nov 2026, #672]
- A cloud session's GitHub writes go through `gh api` (GraphQL answers 403 there), and `tools/hooks/bash-guard.mjs:267`
  asks the owner about every `gh api` write, so orchestrator C prompts for each PR comment: let a short list of
  writes to this repository through, such as issue and PR comments. This changes a hook, so it needs the owner's yes
  and a rail audit. [27 Nov 2026, owner asked why C prompts so often]
- `checkGit` in `tools/hooks/bash-guard.mjs:139-147` never looks at `--delete`, `-d` or a `:branch` refspec, so the
  `git push … task/*`, `design/*` and `claude/*` allow rules in `.claude/settings.json` also let a session delete
  another remote branch unasked: have bash-guard ask about push deletions. [27 Nov 2026, reviewer on #720]
- `checkout_unmatched` stores no amount, currency or buyer hint, so `tools/unmatched-receipts.mjs list` cannot show them:
  store them from the Paddle webhook. [28 Nov 2026, #740]

## Docs
