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

## Docs
