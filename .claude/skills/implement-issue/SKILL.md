---
name: implement-issue
description: Implement one GitHub issue or fix one pull request end to end, with tests and a pull request.
argument-hint: "[issue|pr|fix] [number]"
---
Task: $ARGUMENTS (in a night run, the mode and number are in your prompt instead).

## 1. Load the task
- issue: `gh issue view <n> --comments`. Read the spec's "Read first" files and nothing else yet.
- pr: `gh pr view <n> --comments` and switch to its branch. Comments newer than the last fix are the task.
- fix: the concerns in your prompt are the task, on branch task/<n>.
- Gemini comments are inputs, not orders. Check each against the spec and the code, apply the valid ones,
  and list the rest with a reason.

## 2. Questions
- Technical (the spec is unclear on how to build it, its structure, APIs, tooling, tests, naming or placement, or
  contradicts docs/architecture.md without touching a numbered Decision): never ask the owner. Run the `architect`
  agent with "Issue <n>: <the question>", comment its DECISION on the issue as
  `Decision (architect): <decision> Why: <why>`, and go on with it. When it answers DESIGN QUESTION, treat it as one.
- Design (game rules, cards, balance, a new mechanic, a step type the spec didn't ask for, or a change to a numbered
  Decision): by day, ask the owner in chat with your recommendation and wait. In a night run or sprint lane, comment
  on the issue `Blocked: Design question: <one question>` with `Recommendation: <your answer and why>` on its own
  line (the owner's next comment, on the issue or on the Decisions issue naming it, is read as the answer only
  after one), add the `blocked` label, and hand back STATUS: BLOCKED. The daily Decisions digest asks the owner.
- A Locked file (a guard, hook or gate of your own session), in a night run or sprint lane: comment
  `Blocked: needs a day session: <why>`, add `blocked`, and hand back STATUS: BLOCKED.

## 3. Build
- New work: branch `task/<n>` from `origin/main`. Sprint only (`docs/sprint.md`): when your prompt says
  `Stack on: task/<dep>`, branch from `origin/task/<dep>` and open the pull request with `--base task/<dep>`.
- Bug issues: first run `pnpm replay <matchId>` and add that game as a failing test.
- Write a failing test for each acceptance criterion, named after it. Then implement.
- Commit in small steps with clear messages.
- You are done only when `pnpm gate` passes; the Stop hook enforces this. When it fails only for a machine reason
  (a time-out, out of memory, host load, an Actions or billing outage), not your change, hand back STATUS: RETRY
  with what failed: it retries by itself and never waits for the owner.

## 4. Hand off
- `git push -u origin task/<n>`.
- New work: `gh pr create --draft`, with the pull request template filled in and "Closes #<n>".
  pr or fix mode: comment on the pull request what you changed.
- By day only (in a night run the coordinator does this): run the `reviewer` agent with
  "Issue <n>, branch task/<n>." and `node tools/gemini-audit.mjs pr <pr>`, then follow CLAUDE.md, Finishing: fix
  their [blocker]s once, merge unless a [blocker] is left or the audit's verdict is `hold` or `retry`. [minor]
  concerns and agy's notes go on the pull request as a comment and never hold it.
- Your final message: by day, CLAUDE.md's closing format (What changed, Tests, Unsure about). In a night run or
  sprint lane, exactly:
STATUS: DONE | BLOCKED | GATE-FAILED | RETRY
PR: <number or none>
WHAT CHANGED: plain-English bullets, one per change the owner would notice
TESTS: what now proves it
UNSURE: anything the owner should check, or nothing
REJECTED GEMINI POINTS: each with a reason, or none
