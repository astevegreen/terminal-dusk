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

- No check ties each card's rules text to its numbers (points spent, Escalation moves, counts): the rewording tests
  (`packages/content/src/rulesWording.test.ts`) check the wording's form, not that "spends 2 points" matches the
  card's `spendPoints` amount. A check that reads the numbers out of the text and compares them with the effect
  would catch a card whose text and data disagree. [6 Nov 2026, test-suite audit]
- The 2025-2027 game (`packages/content/scenarios/2025-2027.json`, `SCENARIO_2025_2027`, #582) is data and tests
  only: no host config (`packages/host/src/firstDeck.ts`) or app screen starts it, so no fuzz, AI, balance or vs-AI
  game reaches the future cards yet; only their own card tests and the scenario's play-through test cover them.
  Era 3's one scoring, at the end of turn 11, uses the map's `future` battleground list; only the six-region map is
  checked to have it equal Era 3's, so the host config that starts this game needs the same check. [21 Nov 2026, #582]
- `docs/design/map-and-points.md` ("Map numbers", Open) still says the scenario data has not been changed to the
  21 Nov rules; the scenario is `packages/content/scenarios/base-game.json` since #575. Fix it at the next Notion
  promotion. [21 Nov 2026, #575]

## App, host and server

- The store contracts (`packages/server/src/test/contracts/`, #567) cover `MatchStore`, `InviteStore` and
  `NotifyStore`, but not the `DeadlineStore` half (`due`, `saveClock`) that `MemoryStore` and `SupabaseStore` both
  implement. Add a deadline contract so the fake can't drift from the `clock` and `next_deadline` columns.
  [21 Nov 2026, agy on #567]

## Tests and tooling

- `pnpm gate`'s quick fuzz failed once in `tests/fuzz/extraSteps.test.ts`: "Extra-steps game 188 ... failed at answer
  27: the view for 'sae' shows sae's Contingency deck with a count left that is not the secret order's"
  (`tests/fuzz/checks.ts:256`, `checkNoLeaks`). Each game is seeded from its number, yet the next gate and three
  1,000-game runs of that file passed, so something in that check or the game is not deterministic. Find what.
  [21 Nov 2026, gate run on #583 while a balance run loaded the PC]

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
- A proxy tunnel that stays open but carries nothing makes `postApi` (`tools/gemini/gemini-api.mjs:157`) wait its full
  10-minute idle timeout before passing to the next model; a short limit on the TLS handshake alone would end it in
  seconds, in all three repos. The cloud proxy cuts idle tunnels, so it has not happened. [7 Nov 2026, Gemini API
  tunnel fix review]
- `tools/gemini/gemini-api.mjs` now exports `CUT_LINE`, the diff-cut marker the audit imports (this repo, PR for
  the shared marker); its header says the file is the same in blockchain-technology-course and YODC, so copy it
  there and have their audit scripts import it too. [21 Nov 2026, AI and tools lane]
- The fuzz suites that prove random play "reaches" a feature (`tests/fuzz/easy.test.ts:56`, `reveals.test.ts`,
  `removed.test.ts`, `neutral.test.ts`, `extraSteps.test.ts`) each replay their games again to count events. One
  coverage pass that plays each game once and feeds every counter would save the replays; not merged yet because
  each suite builds its games differently (rulesets, maps, choosers). [6 Nov 2026, test-suite audit]
- `packages/engine/src/views.property.test.ts` and `views.test.ts` overlap (both check what each viewer sees);
  consolidating them into one property suite with a few named examples would cut duplicate cases. [6 Nov 2026,
  test-suite audit]
- `recordSession` in `tools/handoff-notes.mjs:150` reads, adds to and renames the session-ids index with no lock, so
  two sessions saving or claiming in the same instant can drop one entry (only the Sessions pane's note list
  loses it; the note itself is safe). A lock file or an append-only log would close it. [6 Nov 2026, reviewer on
  #523]
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
