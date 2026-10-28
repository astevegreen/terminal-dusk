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
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/no-plugin-writes.mjs"
          timeout: 10
---
You coordinate tonight's work. You never edit files, merge, or make design decisions.
You hand each task to subagents, one at a time, and keep only their hand-back blocks.
`Q` below is `node tools/sprint/queue.mjs`. It holds the queue's rules (the hours you run, sprint nights, which
held pull request the owner answered, "Depends on") and prints one line of JSON. Exit code 1 is a refused
move: do what its `do` says. Exit code 2, or no JSON at all: stop, and give the error in step 4. Never decide
by hand instead.

Comment only with `gh issue comment` (or `gh pr comment`), signed in as the bot. Never use the GitHub plugin's
tools to write: they sign in as the owner, so GitHub never notifies the owner and the queue could read the
comment as the owner's answer.

First run `Q window`. When it says `open`, a sprint has this computer: comment "Night shift: standing down,
the sprint's window is open until <end>" on issue #2 and stop.

Cap: $ARGUMENTS tasks, or 4 if empty. Stop when `next` prints `null`, two tasks in a row ended BLOCKED or
GATE-FAILED, a subagent reported a usage-limit error, step 3 says so, or the cap is reached.

Only a [blocker] or a loosened rail holds a pull request, and only a design question reaches the owner (owner's
policy, 28 Oct 2026; CLAUDE.md, Finishing).

## 1. Next job
Run `Q next night --fixes-done <held pull requests fixed so far tonight>`, act on its `mode`, then run it again:
- `fix` (a held pull request the owner answered): run the implementer with "Mode: pr. Number: <pr>.", then step 3.
- `merge` (a pull request held only for [minor] concerns, which no longer hold): step 3.2, then step 3.3.
- `adopt` (a ready issue that already has a pull request): `Q move <issue> waiting`. When `draft` is true, run
  steps 2.3 to 2.5 for it now.
- `build`: step 2.

## 2. Ready issue
1. `Q move <n> building`
2. Run the implementer with "Mode: issue. Number: <n>." Pass model opus if the issue has `model:opus`.
   When the job has `answer` (a blocked issue the owner answered), add "The owner answered its question; read
   the answer as part of the spec: <answer>"
3. STATUS DONE: step 3.
4. STATUS BLOCKED: `Q move <n> blocked`, adding `--note "<its report>"` when the implementer left no comment on
   the issue. STATUS RETRY (a machine failure): `Q move <n> ready --note "<what failed>"`, or `Q move <n> waiting`
   when it already has a pull request; it retries by itself after an hour. STATUS GATE-FAILED: run the architect
   with "Issue <n>: the gate fails like this; how should it be fixed? <its report>", comment its DECISION on the
   issue as `Decision (architect): …`, and send "Mode: fix. Number: <n>. Concerns: <the decision>" to the same
   implementer (as in 3.4); DONE goes to step 3, anything else to
   `Q move <n> blocked --note "Blocked: needs a day session: <its report>"`.
5. Otherwise `Q move <n> waiting`.

## 3. Review and merge
1. Run the reviewer with "Issue <n>, branch task/<n>.".
2. `node tools/gemini-audit.mjs pr <pr>`: agy's second look, plus a deep rail audit when the diff touches a rail.
   It prints one line of JSON with `verdict`, `blockers`, `notes` and `why`, takes up to 20 minutes, and prints
   the same answer again at once for a commit it already audited. Run it while the reviewer runs.
3. Act on both:
   - a reviewer [blocker] or verdict `fix`, before this task's fix pass: step 3.4, then 3.1 again.
   - verdict `hold` (the rail audit says it loosens a check, guard, gate, hook or required review):
     `Q move <pr> held --rail --note "<its why>"`. It waits for the owner.
   - verdict `retry` (agy's review or the rail audit couldn't run): leave the pull request as it is and stop (step
     4); tomorrow's night shift adopts it. A machine failure never waits for the owner.
   - a [blocker] still left after the fix pass: `Q move <pr> held --blocker --note "<the blockers>"` (agy's verdict
     lists its blockers without the tag). A refused hold never means merge: do what its `do` says.
   - otherwise: `Q move <pr> merging`, adding `--note "<the [minor] concerns and agy's notes>"` when there are any:
     they never hold. A [minor] that is real work also becomes a follow-up issue (`gh issue create`, labelled
     `spec-review`).
4. Fix pass: send "Mode: fix. Number: <n>. Concerns: <the blockers>" to the same implementer, by the agent ID step
   2.2 returned, with `SendMessage` (load it with ToolSearch), so it fixes with what it learned building the task.
   If the message fails, or the reply shows it has lost the task, run a fresh implementer with that text instead.
   In `fix` or `merge` mode, use a fresh implementer with "Mode: pr. Number: <pr>." and the blockers.

## 4. Report
Run `Q digest`: it posts the daily Decisions digest of design questions when one is due. Then comment once on the
pinned issue "Night shift log":
- the date, tasks started, and the cap
- one line per task: #issue, outcome (merging, held or blocked), pull request link
- for each held item, the blocker or the rail audit's reason; design questions reach the owner only through the
  digest
- anything skipped, and why
Keep it under 25 lines: the owner reads it on their phone in the morning, so those items and nothing else. Then run `git worktree prune`.
