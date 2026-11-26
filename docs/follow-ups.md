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

- The six-region track start of 7 towards SAE (#515, #600) was measured only with Hard against Hard; Medium against
  Medium is unmeasured at that start (`node tools/balance/run.mjs --scenario six-region --lio-tier medium --sae-tier
medium`, in 50-game batches). Recheck both tiers when the cards' rewording or the AI changes, and retune
  `map.scoring.track.start` in `packages/content/scenarios/six-region-map.json`. [21 Nov 2026, #515 balance pass]
- `docs/design/map-and-points.md` ("Map numbers", Open) still says the scenario data has not been changed to the
  21 Nov rules; the scenario is `packages/content/scenarios/base-game.json` since #575. Fix it at the next Notion
  promotion. [21 Nov 2026, #575]
- The 2025-2027 host config's refusal of a map whose `future` list is not Era 3's (`packages/host/src/firstDeck.ts`, `scenario2025To2027Config`) has no test that reaches it, since the config always uses the six-region map: let it take the map as a parameter and test a bad one. The balance tool can also get round it: `--numbers` can change only the `era-3` or only the `future` list, and `--era future@N` is accepted for `2025-2027` (`tools/balance/config.mjs`, `numbers.mjs`); re-run the check after those changes. [22 Nov 2026, #604 review]
- LIO's Resilient institutions redraw still follows the deck's owner (`packages/engine/src/abilities.ts` `takeRedraw`,
  and its header comment "Never the World deck"), not the owner's 26 Nov rule that in a card's event it follows who
  played the card (`docs/design/contingency-deck.md`, "Whose bonuses apply"). Two plays differ: LIO playing an SAE card
  whose draw goes to the World deck gets no redraw but should, and an SAE card whose gamble LIO takes from LIO's deck
  gets one but should not. Sent to the engine lane on 26 Nov. [26 Nov 2026, reviewer on #615]
- The abilities' numbers (SAE's 1 more, LIO's once per turn) wait on a Medium-against-Medium balance run that shows
  whether either ability tips the game (`docs/design/sides.md`); report it to the owner, who decides. [26 Nov 2026,
  owner's answer in chat]
- The special abilities (#602, `packages/engine/src/abilities.ts`) (tests/fuzz/abilityChecks.ts checks their state at every fuzz step; tests/golden/abilities.test.ts replays them). No test drives a Resilient institutions redraw through each real draw caller (intervention, realignment, including LIO's defending draw in SAE's realignment, tech race, card events). [22 Nov 2026, reviewer and agy on #610]

## App, host and server

- The online log marks every event of a stand-in step "Played for LIO (deadline passed): …", including events the late
  side did not cause (the other side's own pick in a simultaneous pick, turn-end, scoring, refill, era start). Mark
  only the stand-in's own events, or reword the line. (`packages/app/src/online/onlineGame.ts`,
  `packages/app/src/transport/remoteMatch.ts`). [22 Nov 2026, agy on #611]
- The app's `match_event` read now asks for `stand_in` (`remoteHttp.ts`): deploy migration 20261029000000 before the
  app, or every online game stops updating. Note the order in the release steps. [22 Nov 2026, agy on #611]
- `docs/design/core-loop.md` has a new "Missed deadlines" section (#611) with no Notion promotion entry in its header:
  record it at the next promotion. [22 Nov 2026, agy on #611]
- Under "defaultAnswer", a stand-in refused `standInLimit` (`packages/host/src/hostStandIn.ts`) makes the sweep
  (`packages/server/src/sweepDeadlines.ts`) skip that match on every run, so it never moves or ends. The same
  happens if a plain "both" timeout meets two waits that are not one simultaneous pick (engine `bothWaiting`).
  Neither path is tested, and neither has a fallback. [22 Nov 2026, agy on #609]
- The sweep reports `answered` whenever the stand-in mark is set, even when the stand-in's own answers end the game
  (`sweepDeadlines.ts`, "answered" = the game goes on). It should report `timedOut` or `over`. [22 Nov 2026, reviewer and agy on #609]
- The era names are decided (The Thaw, The Shock, The Fracture; `docs/design/eras.md`) but nothing shows them: the
  app says "Era 1" (`packages/app/src/App.tsx:136`, the era themes in `packages/app/src/game/themes/eraTheme.ts`),
  and the scenarios carry no era name. Show each era's name where its number appears, with the theme. [26 Nov 2026,
  owner's answer in chat]
- A covered side given a new decision in the same turn still gets a turn alert (`hostAccept.ts` `commitSteps`),
  although `hostSubmit` will refuse its answer that turn. [22 Nov 2026, agy on #609]

## Tests and tooling

- `packages/ai/src/medium.ts:37` has a nested ternary (`status.winner === null ? 0 : ...`) that SonarCloud flags; pre-existing, untouched by #610. [22 Nov 2026, Sonar on #610]
- `packages/content/src/rulesSpends.test.ts` (#606) ties spends and Ops swings to their side and branch, but the other
  numbers `rulesNumbers.test.ts` reads (swing floors, Contingency thresholds, Escalation moves, cards discarded) are
  still compared as distinct sets only. e3-sae-003 is checked as a set, so its branches aren't tied (pairing the data's
  "if marker" and "if LIO played" before comparing would close it), and an `if` whose branches spend the same counts
  once, so text naming that spend in one branch only would pass. [22 Nov 2026, reviewer and agy on #606]

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
- Cloud sessions get HTTP 403 from GitHub's GraphQL API, and these still use it: `gh pr list` in
  `tools/gemini-audit.mjs:211` `prs()`, `gh issue list`, `create` and `pin` in its `pinnedIssue()` (`:106`), and the
  `gh issue` and `gh pr` edit, ready and comment steps in `tools/sprint/moves.mjs`'s `issueMove` (`:24`) and `prMove`
  (`:90`). `tools/github-rest.mjs` has the REST reads and the comment; `gh pr ready` and auto-merge need the CCR
  routes the 403 names. [6 Nov 2026, REST fix for the audit's `pr <n>`]
- In a cloud session the Gemini API fallback (#529) reviews an ordinary `pr <n>`, but three audits still end in
  verdict `retry` there: the rail audit (`tools/gemini-audit.mjs:181-185`), a diff too long to send whole
  (`tools/gemini/gemini-api.mjs:60`), and spec and repo audits (`gemini-api.mjs:66`). Each is a choice the code comments explain;
  a PR touching a rail waits for a local run. [7 Nov 2026, reviewer on #538]

## Docs
