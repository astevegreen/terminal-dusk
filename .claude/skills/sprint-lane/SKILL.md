---
name: sprint-lane
description: Coordinator for one lane of the sprint in docs/sprint.md. Run only as /sprint-lane <lane>, from a session the sprint supervisor started.
disable-model-invocation: true
argument-hint: "<rules|app|online|research>"
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/bash-guard.mjs" --unattended
          timeout: 10
    - matcher: "WebFetch"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/no-web.mjs"
          timeout: 10
---
You coordinate lane `$ARGUMENTS` of the sprint in `docs/sprint.md`; read it first. You never edit files,
merge by hand, or make design decisions. You hand each task to subagents, one at a time, and keep only
their hand-back blocks. `L` below is the label `lane:$ARGUMENTS`.

Run the implementer and the reviewer with model `opus` every time. Before every task, stop if:
- `date -u +%Y%m%dT%H%M` is outside the `Window (UTC)` line of `docs/sprint.md`
- any subagent reported a usage-limit error
- you have run 6 tasks this session (the supervisor starts a fresh session next hour)
- nothing below is left

## 1. Pull requests first
`gh pr list --state open --label L --json number,title,headRefName,baseRefName,labels,mergeable,statusCheckRollup,autoMergeRequest,closingIssuesReferences,comments`.
The issue is the one in `closingIssuesReferences`. Take at most 2 fix passes per session:
- `held`, with a comment from the owner newer than the last sprint or night-shift comment
- no `held`, and a failed required check or `mergeable` is `CONFLICTING`. If the pass does not fix it,
  the pull request ends `held` and waits for the owner; never retry a `held` one without a new owner comment.
- base `main`, not draft, no `held`, checks green, `autoMergeRequest` empty: run `gh pr merge <n> --auto --squash` only.
  This also merges a stacked pull request once GitHub has moved it onto `main`.

For a fix pass, run the implementer with "Mode: pr. Number: <n>." and the failing check or conflict in one
line, then the reviewer with "Issue <issue>, branch <headRefName>." (add "Base: <baseRefName>." when the
base is not `main`). PASS: remove `held`, and when the base is `main` run `gh pr merge <n> --auto --squash`.
Concerns left: add `held` and comment the concerns. Skip a pull request that waits only for the owner's approval.

## 2. Stale work
Only one coordinator runs per lane, so at the start of this session an open `L` issue with `in-progress` was left
by a session that stopped. If `gh pr list --head task/<n> --state open` finds a pull request, add `L` to it and remove `in-progress`; if it is
still a draft, run steps 3.3 to 3.6 of step 3 for it now.
Otherwise, unless it has `blocked`, remove `in-progress`, add `sprint-ready`, and comment
"Re-queued by the sprint: the previous lane session stopped." Do this once, at the start.

## 3. Ready issues
`gh issue list --state open --label L --label sprint-ready --json number,title,body,labels`. Leave out any with
`blocked`. Work in backlog order (the ID in the title). Skip any whose "Depends on" issues are still open, except in lane `online`:
there, a dependency whose pull request waits only for the owner's approval may be stacked on.
For each:
1. `gh issue edit <n> --add-label in-progress --remove-label sprint-ready`
2. Run the implementer with "Mode: issue. Number: <n>." For a stacked task add "Stack on: task/<dep>."
3. STATUS DONE: run the reviewer with "Issue <n>, branch task/<n>." (add "Base: task/<dep>." when stacked).
   CONCERNS: run the implementer once more with "Mode: fix. Number: <n>. Concerns: <list>", then the reviewer again.
4. Final PASS: `gh pr ready <pr>`, `gh pr edit <pr> --add-label L`, then `gh pr merge <pr> --auto --squash`, except
   for a stacked pull request: never merge it into `task/<dep>`. Leave it open; once the dependency merges, GitHub
   moves it onto `main` and step 1 turns on auto-merge, so CI and the owner's rules apply.
   Concerns left: `gh pr ready <pr>`, add labels `L` and `held`, and comment the concerns.
5. BLOCKED or GATE-FAILED: check the issue has `blocked` and the implementer's question or report.
6. Remove `in-progress`.

## 4. Report
When you stop, comment once on the sprint log issue (`docs/sprint.md`, Machinery), under 15 lines: the lane, the time, one line per
task (#issue, merging, held or blocked, pull request link), each question the owner must answer, and why you
stopped. Then run `git worktree prune`.
