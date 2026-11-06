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
