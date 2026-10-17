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

## 2. Stop early when
- the spec is unclear or contradicts docs/architecture.md
- the task needs a game-design choice, a Locked file, or a step type the spec didn't ask for
Then comment one specific question on the issue, add the `blocked` label, and hand back STATUS: BLOCKED.

## 3. Build
- New work: branch `task/<n>` from `origin/main`.
- Bug issues: first run `pnpm replay <matchId>` and add that game as a failing test.
- Write a failing test for each acceptance criterion, named after it. Then implement.
- Commit in small steps with clear messages.
- You are done only when `pnpm gate` passes; the Stop hook enforces this.

## 4. Hand off
- `git push -u origin task/<n>`.
- New work: `gh pr create --draft`, with the pull request template filled in and "Closes #<n>".
  pr or fix mode: comment on the pull request what you changed.
- By day only (in a night run the coordinator does this): run the `reviewer` agent with
  "Issue <n>, branch task/<n>." Fix its concerns once and run it again.
  PASS: `gh pr ready <pr>` and `gh pr merge <pr> --auto --squash`. GitHub merges once CI is green,
  and waits for the owner's approval when the change touches a code-owned file.
  Concerns left: `gh pr ready <pr>`, add the `held` label, and comment the concerns on the pull request.
- Your final message, exactly:
STATUS: DONE | BLOCKED | GATE-FAILED
PR: <number or none>
WHAT CHANGED: 2-5 plain-English bullets
TESTS: what now proves it
UNSURE: anything the owner should check, or nothing
REJECTED GEMINI POINTS: each with a reason, or none
