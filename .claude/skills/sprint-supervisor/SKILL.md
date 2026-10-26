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

`Q` below is `node tools/sprint/queue.mjs`. It holds every rule for whether a session has work, and builds
the status block. It prints one line of JSON. If it prints an `error` or no JSON at all, start nothing that
needs it, and put the error first in step 5. Never decide by hand instead; that would bring back a second copy
of the rules.

## 1. Window
Run `Q window`: the window `/sprint-start` opened on this computer, with the sprint's `lanes`, its `log` issue
and the `supervisor` id.
- `none` or `before`: print it and stop.
- `after`: `RemoteTrigger` `update` the `supervisor` id with `{"enabled": false}` (skip in dry-run), comment
  "Sprint over" on the sprint log issue with the lane lines of `Q status`, and stop.
- `open`: go on.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain` is empty and the branch is
`main`, run `git pull --ff-only`. Otherwise leave it alone and note it in step 5.
Run `git worktree prune`.

## 3. Sessions
Each lane in `Q window`'s `lanes` has two session titles: `Sprint lane: <lane>` and `Sprint plan: <lane>`.
`Q sessions` prints, for each title, the id of the newest trigger a supervisor run created for it this
sprint, or `null`. Those recorded ids are the only way to find them: `RemoteTrigger` `list` shows only the
account's newest 20, so a live lane would read as missing and get a second coordinator.

For each title with an id, `list_runs` on it. Its newest run is the session:
- **Running** (`worker_status` is not `idle`, and `last_event_at` is within 60 minutes): leave it.
- **Stuck** (running, but no event in 60 minutes, or waiting for input or permission for 30 minutes): start
  nothing for that title this run. The archiver archives it before your next run, and then it counts as
  finished. Name it in step 5. If the same run is still there and still stuck on your next run, the archiver
  is not working: put that first in step 5.
- **No run yet:** `RemoteTrigger` `get` the id. Enabled, with a `run_once_at` still to come or under 15 minutes
  ago: it is starting, or a restart scheduled after a usage limit; leave it. Otherwise it never started:
  `update` it with `{"enabled": false}` (so a late start can never put two coordinators in one lane), report
  it (step 4), and treat the title as missing.
- **Finished** (`worker_status` `idle`, or `status` `archived`): give `Q resume -` the last lines of its
  `get_run_log` on stdin, in a quoted heredoc so nothing in them runs:
  `Q resume - --last-event <its last_event_at> <<'LOG'`, then the lines, then `LOG` alone on its line.
  `"start": false` means it stopped on a usage limit: start its replacement only when `has-work` (below) says
  so, with `run_once_at` set to its `restartAt`, and name the wait in step 5. Otherwise treat the title as
  missing.
- **Missing** (`null`): run `Q has-work "<title>" --started <sessions you have created this run>` and start one
  only when it prints `"start": true`. Its `reason` goes in step 5 either way.

To start one, `RemoteTrigger` `create` with this body, filling the name, environment, model and prompt:
`{"name": "<title>", "run_once_at": "<now + 1 minute, UTC, ISO 8601 with Z>", "enabled": true,
"job_config": {"ccr": {"environment_id": "<environment_id from Q env>", "session_context": {"model": "<model>"},
"events": [{"data": {"type": "user", "uuid": "<new random UUID from node -e \"console.log(crypto.randomUUID())\">", "parent_tool_use_id": null,
"message": {"role": "user", "content": "<prompt>"}}}]}}}`
Prompt `/sprint-lane <lane>` on model `claude-sonnet-5-5` (the skill runs implementer and reviewer on Opus), or
`/sprint-plan <lane>` on `claude-opus-5-5`. The session runs on the sprint's computer in the main checkout.
`Q env` prints the environment id from `docs/sprint.md` (Machinery); never copy an id from anywhere else, since
it changes when the sprint moves to another computer. If it prints an `error`, start nothing this run.
Straight after each create, `Q started "<title>" <the new trigger's id>`. When that fails, `update` the new
trigger with `{"enabled": false}` and put the error first in step 5: a trigger left unrecorded is one the next
run cannot see.

`has-work` answers `"start": false` with "<n> MB free, under the 4096 MB floor" when memory is low, counting
1536 MB for each session already created this run. Then start nothing more this run, though you still read the
sessions and name stuck ones, and comment "@astevegreen Supervisor: <n> MB free; started nothing" on the sprint
log issue, so GitHub notifies the owner. Don't archive anything or end any process.

Archiving is the sprint archiver's job; don't try it here.

## 4. Status
Every run, `Q status --write` (in dry-run, without `--write`), adding `--need "<title>: stuck since <time>, <url>"`
for each stuck session and `--need "<title>: never started"` for each that never started. It rewrites the
sprint log issue's body: the status block, with the lane counts, the last merge to `main` and its CI result,
free memory, and "Needs you". It prints `body`, `needsYou` and `newNeeds` (the items the old body lacked).

## 5. Report
**Comment** on the sprint log issue, short enough to read on a phone, when either holds:
- `newNeeds` is not empty: start "@astevegreen", so GitHub notifies the owner, and list those items first;
- it is the first run of the window or a sixth UTC hour (00, 06, 12, 18), a session is stuck or never started,
  the archiver is not working, or something in step 2 needed attention: the time, one line per lane (counts,
  sessions started), and anything the owner must act on.
One comment per run at most; when both hold, the ping comes first.
