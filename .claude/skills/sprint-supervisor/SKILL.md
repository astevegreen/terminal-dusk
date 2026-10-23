---
name: sprint-supervisor
description: Hourly supervisor for the sprint in docs/sprint.md. Starts and restarts the lane and plan sessions. Run only from the "Sprint supervisor" scheduled task.
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
or make design decisions. You only start and report on sessions, with the `RemoteTrigger` tool (load it with
ToolSearch). You cannot archive: scheduled sessions have no `archive_session`. The sprint archiver
(`docs/sprint.md`, Machinery) archives finished and stuck sessions. Finish in a few minutes.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, but create, update and
comment nothing.

## 1. Window
Run `date -u +%Y%m%dT%H%M` and read the window from the `Window (UTC)` line of `docs/sprint.md`.
- Before it: print "before the window" and stop.
- After it: `RemoteTrigger` `update` the supervisor trigger whose id is in `docs/sprint.md` (Machinery) with
  `{"enabled": false}` (skip in dry-run), comment "Sprint over" on issue #2 "Night shift log" with one line
  per lane from step 4, and stop. Don't look for it with `list`: that returns only the account's newest 20
  triggers, and asking for the next page returns the first page again.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain` is empty and the branch is
`main`, run `git pull --ff-only`. Otherwise leave it alone and note it in step 5.
Run `git worktree prune`.

## 3. Sessions
**Memory floor.** First read free memory:
`powershell.exe -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)"`.
Under 4096 MB: start nothing this run, though you still read the sessions below and name stuck ones. Comment
"@astevegreen Supervisor: <n> MB free; started nothing" on issue #2, so GitHub notifies the owner, then go on
to step 4. Don't archive anything or end any process.

Lanes: `rules`, `app`, `online`, `research`. For each lane there are two session titles:
`Sprint lane: <lane>` and `Sprint plan: <lane>`.

Run `RemoteTrigger` `list`. For each of the eight titles, take the newest trigger with that exact name and
run `list_runs` on it. Its newest run is the session:
- **Running** (`worker_status` is not `idle`, and `last_event_at` is within 60 minutes): leave it.
- **Stuck** (running, but no event in 60 minutes, or waiting for input or permission for 30 minutes): start
  nothing for that title this run. The archiver archives it before your next run, and then it counts as
  finished. Name it in step 5. If the same run is still there and still stuck on your next run, the archiver
  is not working: put that first in step 5.
- **Missing, or finished** (`worker_status` `idle`, `status` `archived`, or no run yet after its `run_once_at` plus 15 minutes means
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

Archiving is the sprint archiver's job; don't try it here.

## 4. Status
For each lane: open `sprint-ready`, `in-progress`, `blocked` and `held` counts, and pull requests merged
since the window opened (`gh pr list --state merged --label lane:<lane> --search "merged:>=<window start as YYYY-MM-DDTHH:MM:00Z>"`).

## 5. Report
Comment on issue #2 only on the first run of the window, every sixth hour (UTC hour 00, 06, 12, 18), or
when a session is stuck or never started, the archiver is not working, or something in step 2 needed attention. Under 15 lines:
the time, one line per lane (counts, sessions started), and anything the owner must act on,
such as code-owned pull requests waiting for approval (`gh pr list --search "review:required"`).
