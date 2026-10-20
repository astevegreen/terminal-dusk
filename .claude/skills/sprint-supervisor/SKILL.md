---
name: sprint-supervisor
description: Hourly supervisor for the 20-22 October sprint. Starts and restarts the lane and plan sessions. Run only from the "Sprint supervisor" scheduled task.
disable-model-invocation: true
argument-hint: "[dry-run]"
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
You keep the sprint in `docs/sprint.md` running. You never edit files, open pull requests, merge,
or make design decisions. You only start, archive and report on sessions. Finish in a few minutes.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start or archive, but start,
archive, disable and comment nothing.

## 1. Window
Run `date -u +%Y%m%dT%H%M`. The window is `20261021T0000` to `20261022T0600`.
- Before it: print "before the window" and stop.
- After it: disable every scheduled task named "Sprint supervisor" (skip in dry-run), comment
  "Sprint over" on issue #2 "Night shift log" with one line per lane from step 4, and stop.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain` is empty and the branch is
`main`, run `git pull --ff-only`. Otherwise leave it alone and note it in step 5.
Run `git worktree prune`.

## 3. Sessions
Lanes: `rules`, `app`, `online`, `research`. For each lane there are two session titles:
`Sprint lane: <lane>` and `Sprint plan: <lane>`.

Run `list_sessions`. For each of the eight titles, find the newest session with that title.
- **Running and active** (a message in the last 45 minutes): leave it.
- **Waiting for input, or no message in 45 minutes**: archive it, then treat it as missing.
- **Missing, finished or archived**: start one if it has work (below), with `create_session`, in the main
  checkout folder, title as above, prompt `/sprint-lane <lane>` or `/sprint-plan <lane>`.
  Lane sessions run on Sonnet (the skill runs implementer and reviewer on Opus); plan sessions on Opus.

Work exists for a lane session when `gh issue list --state open --label lane:<lane> --label sprint-ready`
or `gh pr list --state open --label lane:<lane>` returns anything, or an open `lane:<lane>` issue has
`in-progress`. Work exists for a plan session when the lane's backlog in `docs/sprint.md` has an ID
with no issue titled `[task] <ID>:` (search with `gh issue list --state all --search "[task] <ID>: in:title"`),
and the lane has fewer than 3 open `sprint-ready` issues.

If any session reported a usage limit in its last message, start nothing new this hour; restart them next hour.

## 4. Status
For each lane: open `sprint-ready`, `in-progress`, `blocked` and `held` counts, and pull requests merged
since the window opened (`gh pr list --state merged --label lane:<lane> --search "merged:>=2026-10-21T00:00:00Z"`).

## 5. Report
Comment on issue #2 only on the first run of the window, every sixth hour (UTC hour 00, 06, 12, 18), or
when you archived a session or something in step 2 needed attention. Under 15 lines:
the time, one line per lane (counts, sessions started or archived), and anything the owner must act on,
such as code-owned pull requests waiting for approval (`gh pr list --search "review:required"`).
