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
their hand-back blocks. `Q` below is `node tools/sprint/queue.mjs`.

`Q` holds the lane's rules: the window, which pull request needs a fix or a merge, what a stopped session
left, and which ready issue comes next (backlog order, "Depends on", stacking in lane `online`, the owner's
replies, Sonar findings the owner accepts). Ask it rather than working them out. It prints one line of JSON.
Exit code 1 is a refused move: do what its `do` says. Exit code 2, or no JSON at all: stop, and give the
error in step 3. Never decide by hand instead; that would bring back a second copy of the rules.

Run the implementer and the reviewer with model `opus` every time. Stop when `next` prints `null`, a
subagent reports a usage-limit error, or you have run 6 tasks this session (the supervisor starts a fresh
session next hour).

## 1. Next job
Run `Q next $ARGUMENTS --fixes-done <fix passes so far this session>`, act on its `mode`, then run it again:
- `merge`: `Q move <pr> merging`.
- `requeue`: `Q move <issue> ready`.
- `settle`: `Q move <issue> blocked`.
- `adopt` (work a stopped session left, or a ready issue that already has a pull request): `Q move <issue> waiting`.
  When `draft` is true, run steps 2.3 to 2.6 for it now.
- `fix` (one fix pass): run the implementer with "Mode: pr. Number: <pr>." and the job's `concerns`, then
  the reviewer with "Issue <issue>, branch <branch>." (add "Base: <base>." when `base` is not `main`).
  PASS: `Q move <pr> merging`, or `Q move <pr> stacked` when `base` is not `main`. Concerns left:
  `Q move <pr> held --note "<concerns>"`, with `--conflict` added when the only concern is a merge conflict.
- `build`: step 2.

## 2. Build
1. `Q move <n> building`
2. Run the implementer with "Mode: issue. Number: <n>." When the job has `stackOn`, add "Stack on: <stackOn>."
   When it has `answer` (a blocked issue the owner answered), add "The owner answered its question; read the
   answer as part of the spec: <answer>"
3. STATUS DONE: run the reviewer with "Issue <n>, branch task/<n>." (add "Base: <stackOn>." when stacked).
   CONCERNS: send "Mode: fix. Number: <n>. Concerns: <list>" to the same implementer, by the agent ID step 2.2
   returned, with `SendMessage` (load it with ToolSearch), so it fixes with what it learned building the task.
   If the message fails, or the reply shows it has lost the task, run a fresh implementer with that text
   instead. Then run the reviewer again.
4. Final PASS: `Q move <pr> merging`. A stacked pull request: `Q move <pr> stacked` instead; it stays a draft
   titled `[stacked on #<dep pr>]`, so nobody can merge it into `task/<dep>`, and once GitHub moves it onto
   `main`, `next` returns it as a merge. Concerns left: `Q move <pr> held --note "<concerns>"`.
5. BLOCKED or GATE-FAILED: `Q move <n> blocked`, adding `--note "<its report>"` when the implementer left no
   comment on the issue.
6. Otherwise `Q move <n> waiting`.

## 3. Report
When you stop, comment once on the sprint log issue (`docs/sprint.md`, Machinery): the lane, the time, one line per
task (#issue, merging, held or blocked, pull request link), each question the owner must answer, and why you
stopped. The owner reads it on their phone: those items and nothing else. Then run `git worktree prune`.
