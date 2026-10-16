---
name: promote
description: Copy approved design decisions and cards from Notion into the repo. Run as /promote.
disable-model-invocation: true
argument-hint: "[Notion page, or 'approved cards']"
---
1. Fetch the named Notion page, or every Card concepts row with status Approved.
2. Rules and systems go to docs/design/<topic>.md, rewritten as precise rules: numbers, timing, edge cases.
   List every ambiguity you find and ask the owner before writing.
3. Cards go to docs/design/cards/<era>.md as table rows. These are the specs the card skill builds from,
   not card JSON.
4. Show the owner the diff. Commit on a branch design/<topic> and open a pull request labelled held.
5. Set the Notion items to Promoted, with the pull request link.
6. If engine or content work follows, offer to run /plan-tasks.
