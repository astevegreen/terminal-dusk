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

- The six-region track start of 7 towards SAE (#515, #600) was tuned with Hard against Hard on 21 Nov, before the
  abilities (#610). Medium against Medium at that start (`node tools/balance/run.mjs --scenario six-region
--lio-tier medium --sae-tier medium --games 50 --seed mm6r-<1..4>`, 200 games): on 26 Nov at ae2a917, abilities
  on, LIO 133, SAE 62, 5 draws (LIO 66.5%); both abilities off, LIO 106, SAE 94 (53%); SAE bonus 2, LIO 122, SAE
  76, 2 draws (61%). Hard against Hard, abilities on (50 games, hh6r-1): LIO 33, SAE 17. After the AI played for
  Unified command (#628), abilities on: LIO 94, SAE 102, 4 draws (LIO 47%); Hard against Hard not re-run. Retune
  decided after the AI fix's re-measure, owner, 26 Nov: "Fix AI first"; the owner chooses the lever
  (`map.scoring.track.start` in `packages/content/scenarios/six-region-map.json`, or the abilities' numbers), if
  one is still needed. [21 Nov 2026, #515 balance pass; 26 Nov 2026, #628]
- `docs/design/map-and-points.md` ("Map numbers", Open) still says the scenario data has not been changed to the
  21 Nov rules; the scenario is `packages/content/scenarios/base-game.json` since #575. Fix it at the next Notion
  promotion. [21 Nov 2026, #575]
- The abilities' numbers (SAE's 1 more, LIO's once per turn) wait on a Medium-against-Medium balance run that shows
  whether either ability tips the game (`docs/design/sides.md`); report it to the owner, who decides. The six-region
  runs (item above): with the AI playing for Unified command (#628), abilities on gives LIO 47% (94-102, 4 draws)
  against 53% with both off, from 66.5% before the fix. Owner, 26 Nov: "Fix AI first"; the numbers wait on the
  owner's read of the re-measure. [26 Nov 2026, owner's answer in chat; #628]
- e2-neu-003's `madeFor: "lio"` mark has no card story that fails without it: add one where SAE plays with
  Resilient institutions and LIO's 1 from SAE's deck stands, like the mirror stories in `e3-neu-001.test.ts` and
  `e3-neu-002.test.ts`. [26 Nov 2026, agy on #634]

## App, host and server

- `docs/design/core-loop.md` has a new "Missed deadlines" section (#611) with no Notion promotion entry in its header:
  record it at the next promotion. [22 Nov 2026, agy on #611]
- `packages/server/src/sweepEdge.ts` `DEADLINE_STATUSES` does not count the sweep's `answered` status (a stand-in
  step under "defaultAnswer"), so the `sweep-deadlines` reply's counts leave those matches out (`countOf`). [26 Nov 2026, #616]
- The online log marks a late side's influence placed by the rival's card event as the stand-in's own move
  (`packages/app/src/online/gameText.ts` `isMoveOf` checks only the event's side). [26 Nov 2026, #616]
- The status bar says "Era not shown yet" until Era 2 starts, so for the whole free game: it reads only the era of an
  `eraStarted` event (`packages/app/src/game/regions.tsx:56`), while the theme falls back to the frame's era
  (`GameScreen.tsx:136`), and a game with no map has no era in its frame (`packages/engine/src/createGame.ts:88`).
  [26 Nov 2026, screenshots for the era names]
- At 844x390 the top bar squeezes the era to no width (`packages/app/src/game/gameBars.css`, the plays and the era
  "give way first", #490) and the Details panel does not show it, so on a phone the status never names the era in
  play. [26 Nov 2026, screenshots for the era names]

## Tests and tooling

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
