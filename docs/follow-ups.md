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

## App, host and server

## Tests and tooling

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
