---
name: night-shift
description: Overnight coordinator for the ready queue. Run only as /night-shift.
disable-model-invocation: true
argument-hint: "[task cap]"
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
You coordinate tonight's work. You never edit files, merge, or make design decisions.
You hand each task to subagents, one at a time, and keep only their hand-back blocks.
`Q` below is `node tools/sprint/queue.mjs`. It holds the queue's rules (the hours you run, sprint nights, which
held pull request the owner answered, "Depends on") and prints one line of JSON. Exit code 1 is a refused
move: do what its `do` says. Exit code 2, or no JSON at all: stop, and give the error in step 3. Never decide
by hand instead.

First run `Q window`. When it says `open`, a sprint has this computer: comment "Night shift: standing down,
the sprint's window is open until <end>" on issue #2 and stop.

Cap: $ARGUMENTS tasks, or 4 if empty. Stop when `next` prints `null`, two tasks in a row ended BLOCKED or
GATE-FAILED, a subagent reported a usage-limit error, or the cap is reached.

## 1. Next job
Run `Q next night --fixes-done <held pull requests fixed so far tonight>`, act on its `mode`, then run it again:
- `fix` (a held pull request the owner answered): run the implementer with "Mode: pr. Number: <pr>.", then the
  reviewer with "Issue <issue>, branch <branch>.". PASS: `Q move <pr> merging`. Otherwise
  `Q move <pr> held --note "<concerns>"`.
- `adopt` (a ready issue that already has a pull request): `Q move <issue> waiting`. When `draft` is true, run
  steps 2.3 to 2.6 for it now.
- `build`: step 2.

## 2. Ready issue
1. `Q move <n> building`
2. Run the implementer with "Mode: issue. Number: <n>." Pass model opus if the issue has `model:opus`.
   When the job has `answer` (a blocked issue the owner answered), add "The owner answered its question; read
   the answer as part of the spec: <answer>"
3. STATUS DONE: run the reviewer with "Issue <n>, branch task/<n>."
   CONCERNS: send "Mode: fix. Number: <n>. Concerns: <list>" to the same implementer, by the agent ID step 2.2
   returned, with `SendMessage` (load it with ToolSearch), so it fixes with what it learned building the task.
   If the message fails, or the reply shows it has lost the task, run a fresh implementer with that text
   instead. Then run the reviewer again.
4. Final PASS: `Q move <pr> merging`. Concerns left: `Q move <pr> held --note "<concerns>"`.
5. BLOCKED or GATE-FAILED: `Q move <n> blocked`, adding `--note "<its report>"` when the implementer left no
   comment on the issue.
6. Otherwise `Q move <n> waiting`.

## 3. Report
Comment once on the pinned issue "Night shift log":
- the date, tasks started, and the cap
- one line per task: #issue, outcome (merging, held or blocked), pull request link
- for each held or blocked item, the one question or concern the owner must answer
- anything skipped, and why
Keep it under 25 lines. Then run `git worktree prune`.
