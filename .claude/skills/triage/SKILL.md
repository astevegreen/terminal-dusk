---
name: triage
description: Turn the week's playtest feedback into design questions and bug issues. Run as /triage.
disable-model-invocation: true
argument-hint: "[week, e.g. 2026-W43; default this week]"
---
1. Read the rows for $ARGUMENTS (or the last 7 days) in the Notion playtest feedback database.
2. Group duplicates: the same complaint or the same broken behaviour, even when worded differently.
   Keep the reporter count and every match ID for each group.
3. Sort each group into exactly one of:
   - **Design question**: the rules work as written, but players find them unclear, unfun or unbalanced.
   - **Bug**: the game did something the rules in docs/design/ say it shouldn't, and there is a match ID.
   - **Not actionable**: no match ID and no way to reproduce, or already fixed on main. Say why.
4. Show the owner the proposed list first: one line per group with its type, title and count.
   Wait for the owner to confirm or edit it. Create nothing before that.
5. Design questions become rows in the Notion Open questions database, linking the feedback rows.
   Never answer a design question yourself.
6. Bugs become GitHub issues from the bug form (`gh issue create --template bug.yml`), in plain language,
   with every match ID, labelled `bug` and `needs-spec`. Check `gh issue list --label bug` for an
   existing issue first and comment on it instead of opening a duplicate.
7. Mark the feedback rows Triaged, with a link to the question or issue each one went to.
8. Report: counts by type, links to everything created, and anything left Not actionable.
