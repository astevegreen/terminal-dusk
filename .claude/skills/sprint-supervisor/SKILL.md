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
or make design decisions. You only start, archive and report on sessions, with the `RemoteTrigger` tool and
`archive_session` (load both with ToolSearch). Finish in a few minutes.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, but create, update and
comment nothing.

## 1. Window
Run `date -u +%Y%m%dT%H%M`. The window is `20261021T0000` to `20261022T0600`.
- Before it: print "before the window" and stop.
- After it: `RemoteTrigger` `list`, then `update` each trigger whose name starts "Sprint supervisor" with
  `{"enabled": false}` (skip in dry-run), comment
  "Sprint over" on issue #2 "Night shift log" with one line per lane from step 4, and stop.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain` is empty and the branch is
`main`, run `git pull --ff-only`. Otherwise leave it alone and note it in step 5.
Run `git worktree prune`.

## 3. Sessions
Lanes: `rules`, `app`, `online`, `research`. For each lane there are two session titles:
`Sprint lane: <lane>` and `Sprint plan: <lane>`.

Run `RemoteTrigger` `list`. For each of the eight titles, take the newest trigger with that exact name and
run `list_runs` on it. Its newest run is the session:
- **Running** (`worker_status` is not `idle`, and `last_event_at` is within 3 hours): leave it.
- **Stuck** (running, but no event in 3 hours, or waiting for input or permission for 45 minutes): do not
  archive it, and start nothing for that title; name it in step 5 with its `url` so the owner can archive it.
- **Missing, or finished** (`worker_status` `idle`, or no run yet after its `run_once_at` plus 15 minutes means
  it never started: report that too): start one if it has work (below).
  First `update` every enabled trigger with that name that has no run to `{"enabled": false}`, so a late
  start can never put two coordinators in one lane.

To start one, `RemoteTrigger` `create` with this body, filling the name, model and prompt:
`{"name": "<title>", "run_once_at": "<now + 1 minute, UTC, ISO 8601 with Z>", "enabled": true,
"job_config": {"ccr": {"environment_id": "env_01NzJ5sYBdPtRrLcXKYr7zTM", "session_context": {"model": "<model>"},
"events": [{"data": {"type": "user", "uuid": "<new random UUID>", "parent_tool_use_id": null,
"message": {"role": "user", "content": "<prompt>"}}}]}}}`
Prompt `/sprint-lane <lane>` on model `claude-sonnet-5-5` (the skill runs implementer and reviewer on Opus), or
`/sprint-plan <lane>` on `claude-opus-5-5`. The session runs on the owner's laptop in the main checkout.

Work exists for a lane session when the lane has an open `sprint-ready` issue without `blocked`, an open
`in-progress` issue, or an open pull request that step 1 of the `sprint-lane` skill would act on. Work exists for a plan session when the lane has fewer than 3 open `sprint-ready` issues and its backlog in
`docs/sprint.md` has an ID that is not done. An ID is done when an issue title starts `[task] <ID>:` or `[task] <ID>` plus a letter and a colon
(a split part). Get every title once with `gh issue list --state all --search "[task] in:title" --limit 500 --json title`
and match the start of the title yourself; GitHub search matches whole words, so `R4` does not find `R4a`.

For a finished run, read the end of `get_run_log`: if it stopped on a usage limit, start nothing new this hour.

Then archive the finished sessions: each one holds 150-500 MB on the owner's laptop until it is archived, and
dozens of them exhausted it on 21 Oct. Archive, with `archive_session` and the run's session id, the newest run
of each of the eight titles when it is finished (after reading its run log), and every finished run of the
triggers named "Sprint supervisor …" except your own, once its `last_event_at` is over an hour old: a session
that ended its turn on a background push or CI watch reads `idle` until that finishes, and archiving it would
kill that work. An archived run counts as finished. Never archive a running or stuck session, or one outside
these titles. If `archive_session` is not available, skip this.

## 4. Status
For each lane: open `sprint-ready`, `in-progress`, `blocked` and `held` counts, and pull requests merged
since the window opened (`gh pr list --state merged --label lane:<lane> --search "merged:>=2026-10-21T00:00:00Z"`).

## 5. Report
Comment on issue #2 only on the first run of the window, every sixth hour (UTC hour 00, 06, 12, 18), or
when a session is stuck or never started, an archive failed, or something in step 2 needed attention. Under 15 lines:
the time, one line per lane (counts, sessions started), and anything the owner must act on,
such as code-owned pull requests waiting for approval (`gh pr list --search "review:required"`).
