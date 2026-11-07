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

- The in-memory stores (`MemoryStore`, `MemoryInviteStore`, `MemoryNotifyStore` in `packages/server/src/store.ts`,
  `inviteStore.ts`, `notifyStore.ts`) and their Supabase twins are tested separately; one shared contract suite run
  against both (the Supabase run on the stack) would catch the fakes drifting from the real tables. [6 Nov 2026,
  test-suite audit]
- `makeUser` (`packages/server/src/test/stack.ts:44-49`) creates the auth user before signing it in, so a failed
  sign-in leaves the user behind, past the clean-up at `stack.ts:114`. Delete the user when the sign-in fails.
  [7 Nov 2026, reviewer on #531]
- A subscriber that throws in a local match is skipped silently (`packages/app/src/transport/localMatch.ts:65`): the
  match carries on, as it should, but nothing records the error. An optional `onSubscriberError` for the caller to
  log would make such a bug visible. [6 Nov 2026, test-suite audit]
- An access token that rejects after expiry (#534) is tested in the lobby's reads and `remoteMatch.submit`, but not
  in `remoteMatch`'s poll (`packages/app/src/transport/remoteMatch.ts:89`), `onlineGame`'s `refreshDeadline`
  (`packages/app/src/online/onlineGame.ts:111`), or the lobby's join after the preview and `pickSide`
  (`packages/app/src/online/lobbySession.ts:183,190`). Each catches the rejection today; a test would pin it.
  [7 Nov 2026, reviewer on #534]

## Tests and tooling

- Agents comment as astevegreen while greenbeanbot is suspended, so after the bot returns a `Blocked:` comment an
  agent posted as the owner can read as the owner's answer (`tools/sprint/rules.mjs:207` `ownerAnswer`): check blocked
  issues then, or mark agent comments so the queue stops relying on the author (7 Nov 2026, review of #540).
- `tools/gates/test-count.mjs:153-159` `heldByOwner` trusts a `held` label added by astevegreen, which agents now add
  too while gh is signed in as the owner, so a PR an agent held may drop tests (7 Nov 2026, review of #540).
- `tools/gemini/agy.mjs` is 435 lines: its Gemini API half (`apiPrompt`, `parseApiReply`, the HTTPS post,
  `geminiApi`) belongs in its own file, split the same way in all three repos. [7 Nov 2026, Gemini API fallback]
- A proxy tunnel that stays open but carries nothing makes `postApi` (`tools/gemini/agy.mjs:311`) wait its full
  10-minute idle timeout before passing to the next model; a short limit on the TLS handshake alone would end it in
  seconds, in all three repos. The cloud proxy cuts idle tunnels, so it has not happened. [7 Nov 2026, Gemini API
  tunnel fix review]
- The "(diff truncated; read the rest from disk)" line is written in `tools/gemini-audit.mjs:151` and matched by
  `TRUNCATED` in `tools/gemini/agy.mjs:180`: one shared constant would stop a reworded marker from sending part of a diff to
  the API. [7 Nov 2026, Gemini API fallback]
- The fuzz suites that prove random play "reaches" a feature (`tests/fuzz/easy.test.ts:56`, `reveals.test.ts`,
  `removed.test.ts`, `neutral.test.ts`, `extraSteps.test.ts`) each replay their games again to count events. One
  coverage pass that plays each game once and feeds every counter would save the replays; not merged yet because
  each suite builds its games differently (rulesets, maps, choosers). [6 Nov 2026, test-suite audit]
- `packages/engine/src/views.property.test.ts` and `views.test.ts` overlap (both check what each viewer sees);
  consolidating them into one property suite with a few named examples would cut duplicate cases. [6 Nov 2026,
  test-suite audit]
- `tools/replay.mjs` is still a stub that says "no server code exists", which is out of date: the host now builds
  replay archives (`hostArchive`). `pnpm replay <matchId>` should be built on them, or its message updated
  (`tools/replay.mjs:3,10-11`); `tools/replay.test.mjs` tests the stub and goes with it. [6 Nov 2026, test-suite audit]
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
  (`tools/gemini/agy.mjs:199`), and spec and repo audits (`agy.mjs:220`). Each is a choice the code comments explain;
  a PR touching a rail waits for a local run. [7 Nov 2026, reviewer on #538]
- `node tools/gemini-audit.mjs specs <n>` throws "ghRun is not a function": `specs()` calls `numbers.map(issueText)`
  (`tools/gemini-audit.mjs:131`), so the array index lands in `issueText`'s `ghRun`. Already on main; no test covers
  the specs path. [6 Nov 2026, reviewer on #525]

## Docs

- `CLAUDE.md:10` says "CI runs 10,000 with `pnpm fuzz`" and `tests/README.md:7` says `pnpm fuzz` runs "in CI": since
  the fuzz sizing (`tools/gates/fuzz-games.mjs`) a pull request that leaves the engine, content, host, AI and tests/
  alone plays 2,000; main and Nightly still play 10,000. [7 Nov 2026, CI-speed session]
