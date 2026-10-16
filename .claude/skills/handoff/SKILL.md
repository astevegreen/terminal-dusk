---
name: handoff
description: Write a short hand-off note before ending a long session or switching devices. Run as /handoff.
disable-model-invocation: true
argument-hint: "[topic]"
---
Write `.handoff/<YYYY-MM-DD>-<topic>.md`, where topic is $ARGUMENTS or a 2-4 word slug of the session's goal.
The folder is git-ignored; never commit it. Keep the note under 30 lines:

# <topic> - <date>
## Goal
One or two sentences: what this session set out to do.
## Done
- what is finished and proven, with the test or check that proves it
## Next
- the next concrete steps, in order, specific enough for a fresh session to start on the first
## Open questions
- decisions waiting for the owner, or "none"
## Files touched
- paths, with one line each on what changed; plus the branch name and whether it is pushed

Then tell the owner the note's path and suggest starting the next session fresh with
"Read .handoff/<file> and continue."
