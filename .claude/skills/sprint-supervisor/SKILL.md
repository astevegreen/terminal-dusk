---
name: sprint-supervisor
description: Hourly supervisor for the sprint in docs/sprint.md. Starts and restarts the lane and plan sessions. Run only from the "TD sprint supervisor" scheduled task or its wake.
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
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/no-plugin-writes.mjs"
          timeout: 10
---
You keep the sprint in `docs/sprint.md` running. You never edit files, open pull requests, merge,
or make design decisions. You only start and report on sessions, with the `RemoteTrigger` tool (load it with
ToolSearch), and read your usage limit and keep your wake with the claude-code-remote `get_session`,
`create_trigger` and `update_trigger` tools (step 3b). You cannot archive: scheduled sessions have no
`archive_session`. Step 2b ends finished and stuck sessions' local processes instead, which frees their bridge
slots, and the sprint archiver (`docs/sprint.md`, Machinery) archives them. Finish in a few minutes.

Comment only with `gh issue comment`, signed in as the bot. Never use the GitHub plugin's tools to write: they
sign in as the owner, so GitHub never notifies the owner of the comment and the queue could read it as the
owner's answer.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, but create, update and
comment nothing.

`Q` below is `node tools/sprint/queue.mjs`. It holds every rule for whether a session has work, and builds
the status block. It prints one line of JSON. If it prints an `error` or no JSON at all, start nothing that
needs it, and put the error first in step 5. Never decide by hand instead; that would bring back a second copy
of the rules.

## 1. Window
Run `Q window`: the window `/sprint-start` opened on this computer, with the sprint's `lanes`, its `log` issue,
the `supervisor` and `wake` ids, and `stoppedBy`.
- `none` or `before`: print it and stop.
- `after`: do step 2b, then `update_trigger` the `supervisor` id with `enabled` `false`, and the `wake` id the
  same way when it is not null (skip both in dry-run). Comment "Sprint over" on the sprint log issue with the
  lane lines of `Q status`, and stop. When `stoppedBy` is `sprint-stop`, the owner ended the window early with
  `/sprint-stop`: say "Sprint stopped by /sprint-stop at <end>" instead, never as a fault or a machinery bug, and
  never ask the owner to run `/sprint-start` again. When an update is refused, start the comment "@astevegreen"
  and ask the owner to switch it off at https://claude.ai/code/routines/<id>.
- `open`: go on.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain` is empty and the branch is
`main`, run `git pull --ff-only`. Otherwise leave it alone and note it in step 5.
Run `git worktree prune`.

## 2b. Bridge slots
Each sprint session holds one of the bridge's `--capacity` slots until its process ends, finished or not, and
with every slot held no new session gets a worker, your own next run included (after-sprint fix 13, 26 Oct). So
every run with `state` `open` or `after`, even when `Q env` refuses, frees the slots of finished and stuck
sessions:
1. `node C:/Antigravity/sprints/free-bridge-slots.mjs list TD` prints this repo's bridge: its `capacity` and its
   `children` (`cse_` ids). Nothing printed: no bridge named TD runs; say so in step 5 and go on.
2. Find each child's run with `RemoteTrigger` `list_runs` (a run's `id` is the child's `cse_` id): on the
   `supervisor` and `wake` ids `Q window` printed (each one not null), then on each id `Q sessions --all`
   prints, newest first. Page with `next_cursor` as `cursor`. Stop once every child is found or every id is read.
3. `node C:/Antigravity/sprints/free-bridge-slots.mjs reap TD --stuck-min 60 <id>=<worker_status>@<last_event_at> ...`,
   one argument per child found, each field copied from its run as it is. The script ends a child only when its
   run is idle with no event for 60 minutes, or working with no event for 60 minutes (stuck); never one it has
   no run for, and never this session. It prints `ended` and `kept`; exit 2 is a refusal that ended nothing.
   Put its line in step 5 when it refused, or when `kept` is within 4 of `capacity`.
In a dry run, do 1 and 2 and print the `reap` line without running it. Never end a process any other way, nor
the bridge itself. An ended session stays on claude.ai, and the bridge starts it again if a message reaches it.

## 3. Sessions
Each lane in `Q window`'s `lanes` has two session titles: `TD lane: <lane>` and `TD plan: <lane>`.
`Q sessions` prints, for each title, the id of the newest trigger a supervisor run created for it this
sprint, or `null`. Those recorded ids are the only way to find them: `RemoteTrigger` `list` shows only the
account's newest 20, so a live lane would read as missing and get a second coordinator.

For each title with an id, `list_runs` on it. Its newest run is the session:
- **Running** (`worker_status` is not `idle`, and `last_event_at` is within 60 minutes): leave it.
- **Stuck** (running, but no event in 60 minutes, or waiting for input or permission for 30 minutes): start
  nothing for that title this run. Step 2b ends its process on your next run, and then it counts as finished.
  Name it in step 5. If the same run is still there and still stuck on your next run, step 2b is not working:
  put its `reap` line first in step 5.
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
`Q env` prints the environment id `/sprint-start` found in `list_environments` and recorded with the window;
never copy an id from anywhere else, since it changes when the sprint moves to another computer. If it prints an `error`, start nothing this run.
Straight after each create, `Q started "<title>" <the new trigger's id>`. When that fails, `update` the new
trigger with `{"enabled": false}` and put the error first in step 5: a trigger left unrecorded is one the next
run cannot see.

`has-work` answers `"start": false` with "<n> MB free, under the 4096 MB floor" when memory is low, counting
1536 MB for each session already created this run. Then start nothing more this run, though you still read the
sessions and name stuck ones, and comment "@astevegreen Supervisor: <n> MB free; started nothing" on the sprint
log issue, so GitHub notifies the owner. Don't archive anything or end any process outside step 2b.

Archiving is the sprint archiver's job; don't try it here.

## 3b. Wake
While a usage limit is on, a scheduled run fails before it starts, so lanes it stopped would wait for the next
hourly run. So every run with `state` `open` moves one standing one-shot of this task, "TD sprint supervisor
wake", to 2 minutes after the limit resets. Skip this step with any other `state`.
1. Call `get_session` with no `session_id`: it describes this session.
   `external_metadata.rate_limit_info.resetsAt` is the reset, in epoch seconds.
2. Run `Q wake --resets-at <resetsAt>`, or `Q wake` when the tool, the session or `resetsAt` is missing. It
   prints `arm`, `runOnceAt`, `wake` (the id on record, or null), `reason`, and sometimes `log`.
3. `arm` true and `wake` not null: `update_trigger` that id with `run_once_at` `<runOnceAt>` and `enabled`
   `true`: an update re-arms a one-shot that has fired. When it says the trigger is not found, make it as in 4.
4. `arm` true and `wake` null: `create_trigger` with name `TD sprint supervisor wake`, run_once_at
   `<runOnceAt>`, prompt `/sprint-supervisor`, create_new_session_on_fire `true`, environment_id from `Q env`
   and initiation `own_followup`, and no `connectors` (the org refuses them there). Straight after,
   `Q window ids --wake <its trig_ id>`. When that refuses, `update_trigger` the new one with `enabled` `false`
   and put the error first in step 5.
5. `arm` false: change nothing. When it printed `log`, name it in step 5.
In a dry run, only print what you would do.

## 4. Status
Every run, `Q status --write` (in dry-run, without `--write`), adding `--need "<title>: stuck since <time>, <url>"`
for each stuck session and `--need "<title>: never started"` for each that never started. It rewrites the
sprint log issue's body: the status block, with the lane counts, the last merge to `main` and its CI result,
free memory, and "Needs you". It prints `body`, `needsYou` and `newNeeds` (the items the old body lacked).
Questions are in "Needs you" but never in `newNeeds`: design questions reach the owner only through the Decisions
digest, at most once a day. So every run (not in dry-run) also runs `Q digest`, which posts it when one is due.

## 5. Report
**Comment** on the sprint log issue, under 15 lines for the owner's phone, when either holds:
- `newNeeds` is not empty: start "@astevegreen", so GitHub notifies the owner, and list those items first;
- it is the first run of the window or a sixth UTC hour (00, 06, 12, 18), a session is stuck or never started,
  step 2b refused or is near capacity, or something in step 2 needed attention: the time, one line per lane (counts,
  sessions started), and anything the owner must act on.
One comment per run at most; when both hold, the ping comes first.
