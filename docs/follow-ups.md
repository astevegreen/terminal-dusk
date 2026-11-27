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
- e2-neu-003's `madeFor: "lio"` mark has no card story that fails without it: add one where SAE plays with
  Resilient institutions and LIO's 1 from SAE's deck stands, like the mirror stories in `e3-neu-001.test.ts` and
  `e3-neu-002.test.ts`. [26 Nov 2026, agy on #634]
- Realigning ignores closed regions: `realignTargets` (`packages/engine/src/influence.ts:72-75`) offers every
  country where the rival has influence, while intervening checks `isRegionClosed` (`intervening.ts`), and
  `docs/design/map-and-points.md` ("Thresholds close regions") closes regions to both. The tests mark it as still
  to do (`realign.test.ts:115`, `placing.test.ts:150`). [27 Nov 2026, architect on the tutorial chain, PR #649]

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
- The client has no entitlements yet: #647 adds `ownsFullGame` for the tutorial only. When web checkout lands
  (phase 6), wire real client entitlements in and put the same Era 1 stop in front of the other games against the
  AI. [27 Nov 2026, architect on the tutorial chain]
- The existing free game against the AI (`era-1-free`) ends without the Full Game offer that #647 adds to the
  tutorial; show it there too. [27 Nov 2026, architect on the tutorial chain]
- Nothing tests what follows the tutorial game's end: Watch replay, and New game starting the lesson again at
  chapter 1 (`packages/app/src/tutorial/TutorialScreen.tsx`), nor the full edition's end view. #647 tests only the
  free edition's end view and offer. [27 Nov 2026, reviewer on PR #662]
- The tutorial's coach box (`packages/app/src/tutorial/tutorial.css`, fixed at top 48px, left 8px) lies over the
  map's `.dm-tools` buttons (Map / List / Whole map), so a learner can't tap them while coached: move the box clear of
  them. [27 Nov 2026, agy on PR #662]

- The online log marks a late side's `pointsSpent` and `cardsDiscarded` by the event's side alone
  (`packages/app/src/online/gameText.ts` `isMoveOf`), and a card's event can give both without an answer. If a card
  ever gives them inside that side's own stand-in run (rival-granted points, a random discard), the line reads
  "Played for X" although the stand-in chose nothing; no content card is known to discard that way today. [26 Nov
  2026, reviewer and agy on #633]
- `docs/design/core-loop.md` has a new "Missed deadlines" section (#611) with no Notion promotion entry in its header:
  record it at the next promotion. [22 Nov 2026, agy on #611]
- The status bar says "Era not shown yet" until Era 2 starts, so for the whole free game: it reads only the era of an
  `eraStarted` event (`packages/app/src/game/regions.tsx:56`), while the theme falls back to the frame's era
  (`GameScreen.tsx:136`), and a game with no map has no era in its frame (`packages/engine/src/createGame.ts:88`).
  [26 Nov 2026, screenshots for the era names]
- At 844x390 the top bar squeezes the era to no width (`packages/app/src/game/gameBars.css`, the plays and the era
  "give way first", #490) and the Details panel does not show it, so on a phone the status never names the era in
  play. [26 Nov 2026, screenshots for the era names]

## Tests and tooling

- The app's browser tests are not type-checked (`packages/app/tsconfig.json` includes only `src` and
  `vite.config.ts`), so `packages/app/e2e/bars/bars.tsx` has already drifted: its two `OnlineGameSnapshot` objects
  lack `signedOut`. Add `e2e` to a type check and fix what it finds. [27 Nov 2026, sound chain, #646]
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
- `docs/repo-map.md` is still tracked, but the pre-commit hook no longer refreshes it, so it goes stale until someone
  runs `pnpm repo-map` (in a small PR of its own, not inside feature PRs). Next step: `git rm --cached` it, add it to
  `.gitignore`, and generate it into the working tree (plain `node tools/repo-map.mjs`) from new
  `tools/git-hooks/post-checkout` and `post-merge` hooks (post-checkout fires on `git worktree add` too) and the root
  `prepare` script, each tested like `pre-commit.test.mjs`. Then fix the wording that says every commit refreshes it:
  `tools/repo-map.mjs` `renderMap` header, `docs/workflow.md:244,376`, `.claude/agents/reviewer.md:41`,
  `tools/gemini/prompts/pr-audit.md:3`; and drop `repo-map.mjs --staged`, which nothing calls now. [7 Nov 2026, CI-speed session, Decision (architect)]
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
- With no REST route, `gh pr ready`, `gh pr merge --auto` (`tools/sprint/moves.mjs:172`) and `gh issue pin`
  (`tools/gemini-audit.mjs:143`) report a cloud session's 403 and stop there; the CCR routes the 403 names could do
  them. [27 Nov 2026, #665]
- In a cloud session the Gemini API fallback (#529) reviews an ordinary `pr <n>`, but three audits still end in
  verdict `retry` there: the rail audit (`tools/gemini-audit.mjs:181-185`), a diff too long to send whole
  (`tools/gemini/gemini-api.mjs:60`), and spec and repo audits (`gemini-api.mjs:66`). Each is a choice the code comments explain;
  a PR touching a rail waits for a local run. [7 Nov 2026, reviewer on #538]
- `checkOwnMoves` (`tests/fuzz/moveChecks.ts`) runs only in its own random games, so the `extraSteps` and
  `reactions` fuzz suites do not check it: call it from the game loop in `tests/fuzz/play.ts`. [26 Nov 2026, agy
  on #633]
- agy's audit reads only the issue's body (`tools/github-rest.mjs:35` `issue()`), never its `Decision (architect)`
  comments, so it flags a PR that follows a Decision as off-spec until the body is rewritten by hand: send the
  owner's and the architect's Decision comments with the spec. [27 Nov 2026, agy on #654]

## Docs
