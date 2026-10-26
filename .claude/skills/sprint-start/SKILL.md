---
name: sprint-start
description: Cue the sprint in docs/sprint.md now - check the computer, open the window, make the supervisor and the archiver. Run only as /sprint-start [hours] [--dry-run].
disable-model-invocation: true
argument-hint: "[hours] [--dry-run]"
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
You start the sprint in `docs/sprint.md` now. `$ARGUMENTS` holds the window's length in whole hours (38 when
none is given) and may hold `--dry-run`. No one may be watching, so the checks below decide everything: start,
start with what is short named, or refuse. You never edit files, open pull requests, merge, or make design
decisions. `Q` below is `node tools/sprint/queue.mjs`: it prints one line of JSON and exits 1 when it refuses a
move and 2 when it fails; its `error` is your reason.

**Dry run** (`--dry-run`): every check and every read, and nothing that writes: no pull, no stack start, no
`create_*`, `fire_trigger`, `Q window start/ids` without `--dry-run`, or comment. It proves the cue before the
owner relies on it.

Your last message starts with exactly one of these lines, then at most 8 lines from step 6, for the owner's phone:
- `STARTED terminal-dusk window <start>–<end>`, both from `Q window` (they end in `Z`)
- `REFUSED terminal-dusk: <reason>`
- `DRY-RUN OK terminal-dusk`
- `DRY-RUN FAIL terminal-dusk: <each failed refusal check, separated by "; ">`

In a dry run, a refusal check that fails goes on the FAIL line and the run carries on, so one dry run names
every problem. Otherwise the first refusal ends the run.

## 1. Refusal checks
In the main checkout:
1. **On main:** `git branch --show-current` is `main` and `git status --porcelain` is empty, then
   `git pull --ff-only` (in a dry run, `git fetch origin main`, and say so when `HEAD` is behind `origin/main`).
   Then `tools/sprint/cue.mjs` exists. Reasons: `the main checkout is on <branch>`, `the main checkout has
   uncommitted changes`, `the sprint machinery is not on main yet (#289)`.
2. **Environment:** `Q env` prints an `environment_id`, and `list_environments` (claude-code-remote; load the
   remote tools with ToolSearch) lists it. Reason: Q's error, or `environment <id> is not listed`.
3. **No window open:** `Q window` does not say `open`. Reason: `a window is already open, until <end>`.

## 2. What is short
Each of these is a line in step 6, never a refusal:
- Under 30 GB of free disk or 8192 MB of free memory:
  `node -e "const s=require('fs').statfsSync('.');console.log(Math.round(s.bavail*s.bsize/2**30))"` (GB) and
  `node -e "console.log(Math.round(require('os').freemem()/2**20))"` (MB).
- 10 or more sessions in this project's environment are not archived: "archive some on the rc host". Count them
  with `list_sessions` (`mine: true`, `limit: 10`, since each session is about 2,000 characters; while `has_more`
  and fewer than 10 are counted, call it again with `after_id` set to the last response's `last_id`, up to 5
  pages): only those whose `environment_id` is the one `Q env` printed and whose `session_status` is not
  `SESSION_STATUS_ARCHIVED`. Other projects' sprints share the computer, and their sessions are theirs to archive.
- The local Supabase stack: `docker info --format "{{.ServerVersion}}"` succeeds, and
  `pnpm --filter @terminal-dusk/server exec supabase status > /dev/null 2>&1` exits 0. When it doesn't (and
  this is no dry run), run `pnpm --filter @terminal-dusk/server exec supabase start > /dev/null 2>&1` and check
  again. Still down: "the stack is down, so the online lane's stack tests will skip". Their output holds the
  stack's local keys, so it always goes to `/dev/null`.
- `Q night-shift`: when `active`, its `reason`.

## 3. Open the window
`Q window start <hours>`, adding `--dry-run` in a dry run. When it refuses because the last window's archiver
is still on record, `RemoteTrigger` `get` that id (load RemoteTrigger with ToolSearch). Disabled: in a dry run
this check passes, so note "a real start clears the last archiver" and go to step 6; otherwise run
`Q window archived`, then `Q window start <hours>` again. Enabled: its sessions may still be running, so refuse
with the `error`. Any other exit 1 or 2: refuse with its `error` (a dry run puts it on the FAIL line). From here
on, a dry run stops: give its report (step 6).

## 4. The scheduled tasks
1. **Supervisor:** `create_trigger` with name `Sprint supervisor`, cron_expression `2 * * * *`, prompt
   `/sprint-supervisor`, create_new_session_on_fire `true`, environment_id from `Q env`, connectors `[]` and
   initiation `human_request`. Then `Q window ids --supervisor <its trig_ id>`. When the create fails, run
   `Q window stop` and refuse: `could not create the supervisor: <error>`.
2. **Archiver:** `create_session` with title `Sprint archiver`, model `claude-haiku-5-5` and the same
   environment_id, and no prompt. When that fails, the archiver uses this session instead: `get_session` with no
   id gives its id. Then `create_trigger` with name `Sprint archiver`, cron_expression `50 * * * *`,
   persistent_session_id that session, initiation `human_request`, and as prompt the archiver prompt in
   `docs/sprint.md` (Machinery), copied exactly. Then `Q window ids --archiver <its trig_ id>`. When the trigger
   create fails, the sprint still starts: "no archiver, so finished sessions pile up; archive by hand".

## 5. Go
`fire_trigger` the supervisor, so the lanes start now rather than at minute 2. Then
`gh issue comment <log from Q window> --body "<the step 6 lines>"`.

## 6. Report
After the first line: the window in Eastern (`eastern` from `Q window`); the supervisor's and the archiver's ids
and the session the archiver posts into (say "this session; leave it open" when it is this one); the night
shift's task in flight; and each item from step 2.
