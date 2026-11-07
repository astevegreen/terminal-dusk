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

## App, host and server

- `sweepTurnAlerts` (`packages/server/src/sweepTurnAlerts.ts:72`) sends the email before it marks the alert sent,
  so two sweeps running at once (or a sweep that dies after sending) can send the same turn alert twice. Claiming
  the alert first (a conditional update on `sent_at is null`) would make the job safe to run twice, as the server
  rules require. Needs the local stack to prove. [6 Nov 2026, test-suite audit]
- `remoteMatch` polling (`packages/app/src/transport/remoteMatch.ts:89`) treats a 401 like any failed read and keeps
  polling, so an expired or revoked session shows a game that silently stops updating. It could surface
  `notSignedIn` to the screen; how the screen shows it is a UI choice. [6 Nov 2026, test-suite audit]
- No stack test checks row-level security across the whole table catalogue: each table's own migration test checks
  its policies, but a new table with RLS left off would pass. A stack test that lists every public table and
  proves a signed-in client can neither read another player's rows nor write any would close it. Stack-only, so
  unverified in cloud sessions (no Docker). [6 Nov 2026, test-suite audit]
- The in-memory stores (`MemoryStore`, `MemoryInviteStore`, `MemoryNotifyStore`) and their Supabase twins are tested
  separately; one shared contract suite run against both (the Supabase run on the stack) would catch the fakes
  drifting from the real tables. [6 Nov 2026, test-suite audit]
- With an access token already expired, a refresh that fails for a moment makes `accessToken()` return null while
  the player still shows as signed in, so the game screen refuses with "Sign in to play." and the lobby with "You
  are signed out." (`packages/app/src/transport/remoteMatch.ts:146`, `packages/app/src/online/lobby.ts:44`). A
  network refusal is the honest message there; no test covers the path. [7 Nov 2026, PR #528 review]
- `notify` is optional in the submit and invite deps types (`packages/server/src/submit.ts:17`,
  `packages/server/src/invite.ts:30`), so an Edge entry that builds its deps inline again would silently stop turn
  alerts; `functionDeps.test.ts` tests only the helper, and the invite path has no stack test. Making it a required
  `NotifyStore | undefined` lets the type checker catch it. [7 Nov 2026, PR #528 review]

## Tests and tooling

- The fuzz suites that prove random play "reaches" a feature (`tests/fuzz/easy.test.ts:56`, `reveals.test.ts`,
  `removed.test.ts`, `neutral.test.ts`, `extraSteps.test.ts`) each replay their games again to count events. One
  coverage pass that plays each game once and feeds every counter would save the replays; not merged yet because
  each suite builds its games differently (rulesets, maps, choosers). [6 Nov 2026, test-suite audit]
- `packages/engine/src/views.property.test.ts` and `views.test.ts` overlap (both check what each viewer sees);
  consolidating them into one property suite with a few named examples would cut duplicate cases. [6 Nov 2026,
  test-suite audit]
- `tools/replay.mjs` is still a stub that says "no server code exists", which is out of date: the host now builds
  replay archives (`hostArchive`). `pnpm replay <matchId>` should be built on them, or its message updated;
  `tools/replay.test.mjs` tests the stub and goes with it. [6 Nov 2026, test-suite audit]

- `recordSession` in `tools/handoff-notes.mjs` reads, adds to and renames the session-ids index with no lock, so
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
  `tools/gemini-audit.mjs` `prs()`, `gh issue list`, `create` and `pin` in its `pinnedIssue()`, and the `gh pr`
  and `gh issue` edit, ready and comment steps in `tools/sprint/moves.mjs`. `tools/github-rest.mjs` has the REST
  reads and the comment; `gh pr ready` and auto-merge need the CCR routes the 403 names. [6 Nov 2026, REST fix for
  the audit's `pr <n>`]
- `agy` (the Gemini CLI) is not installed in cloud sessions, so `node tools/gemini-audit.mjs pr <n>` there always
  ends in verdict `retry` and a cloud session's pull request waits for a local or workflow run. [6 Nov 2026, audit
  of #524 from a cloud session]
- `node tools/gemini-audit.mjs specs <n>` throws "ghRun is not a function": `specs()` calls `numbers.map(issueText)`
  (`tools/gemini-audit.mjs:128`), so the array index lands in `issueText`'s `ghRun`. Already on main; no test covers
  the specs path. [6 Nov 2026, reviewer on #525]

## Docs
