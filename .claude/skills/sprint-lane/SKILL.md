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
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/no-plugin-writes.mjs"
          timeout: 10
---
You coordinate lane `$ARGUMENTS` of the sprint in `docs/sprint.md`; read it first. You never edit files,
merge by hand, or make design decisions. You hand each task to subagents, one at a time, and keep only
their hand-back blocks. `Q` below is `node tools/sprint/queue.mjs`.

Comment only with `gh issue comment` (or `gh pr comment`), signed in as the bot. Never use the GitHub plugin's
tools to write: they sign in as the owner, so GitHub never notifies the owner and the queue could read the
comment as the owner's answer.

`Q` holds the lane's rules: the window, which pull request needs a fix or a merge, what a stopped session
left, and which ready issue comes next (backlog order, "Depends on", stacking in lane `online`, the owner's
replies, Sonar findings the owner accepts). Ask it rather than working them out. It prints one line of JSON.
Exit code 1 is a refused move: do what its `do` says. Exit code 2, or no JSON at all: stop, and give the
error in step 4. Never decide by hand instead; that would bring back a second copy of the rules.

Run the implementer, the reviewer and the architect with model `opus` every time. Stop when `next` prints
`null`, a subagent reports a usage-limit error, step 3 says so, or you have run 6 tasks this session (the
supervisor starts a fresh session next hour).

Only a [blocker] or a loosened rail holds a pull request, and only a design question reaches the owner (owner's
policy, 28 Oct 2026; CLAUDE.md, Finishing).

## 1. Next job
Run `Q next $ARGUMENTS --fixes-done <fix passes so far this session>`, act on its `mode`, then run it again:
- `merge`: step 3.2 (the audit), then step 3.3.
- `requeue`: `Q move <issue> ready`.
- `settle`: `Q move <issue> blocked`.
- `adopt` (work a stopped session left, or a ready issue that already has a pull request): `Q move <issue> waiting`.
  When `draft` is true, run steps 2.3 to 2.5 for it now. First, when `git worktree list --porcelain` shows
  its branch (or that branch with a `-<m>` suffix) in a worktree whose `git -C <that path> status --porcelain`
  lists anything, the stopped session left work it never committed: run the implementer with "Mode: fix.
  Number: <issue>. A stopped session left uncommitted work in another worktree; carry it over, commit and
  push it." before 2.3.
- `fix` (one fix pass): run the implementer with "Mode: pr. Number: <pr>." and the job's `concerns`, then step 3.
- `build`: step 2.

## 2. Build
1. `Q move <n> building`
2. Run the implementer with "Mode: issue. Number: <n>." When the job has `stackOn`, add "Stack on: <stackOn>."
   When it has `answer` (a blocked issue the owner answered), add "The owner answered its question; read the
   answer as part of the spec: <answer>"
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
1. Run the reviewer with "Issue <n>, branch <branch>." (add "Base: <base>." when `base` is not `main`).
2. `node tools/gemini-audit.mjs pr <pr>`: agy's second look, plus a deep rail audit when the diff touches a rail.
   It prints one line of JSON with `verdict`, `blockers`, `notes` and `why`, takes up to 20 minutes, and prints
   the same answer again at once for a commit it already audited. Run it while the reviewer runs.
3. Act on both:
   - a reviewer [blocker] or verdict `fix`, before this task's fix pass: step 3.4, then 3.1 again.
   - verdict `hold` (the rail audit says it loosens a check, guard, gate, hook or required review):
     `Q move <pr> held --rail --note "<its why>"`. It waits for the owner.
   - verdict `retry` (agy's review or the rail audit couldn't run): leave the pull request as it is, and stop this
     session (step 4): the next one adopts it and audits again. A machine failure never waits for the owner.
   - a [blocker] still left after the fix pass: `Q move <pr> held --blocker --note "<the blockers>"` (agy's verdict
     lists its blockers without the tag). A refused hold never means merge: do what its `do` says.
   - otherwise: `Q move <pr> merging`, or `Q move <pr> stacked` when `base` is not `main` (it stays a draft
     titled `[stacked on #<dep pr>]`, so nobody can merge it into `task/<dep>`; once GitHub moves it onto `main`,
     `next` returns it as a merge). Add `--note "<the [minor] concerns and agy's notes>"` when there are any:
     they never hold. A [minor] that is real work also becomes a follow-up issue (`gh issue create`, with the
     lane label and `spec-review`).
4. Fix pass: send "Mode: fix. Number: <n>. Concerns: <the blockers>" to the same implementer, by the agent ID step
   2.2 returned, with `SendMessage` (load it with ToolSearch), so it fixes with what it learned building the task.
   If the message fails, or the reply shows it has lost the task, run a fresh implementer with that text instead.
   In `fix` or `merge` mode, use a fresh implementer with "Mode: pr. Number: <pr>." and the blockers.

## 4. Report
When you stop, run `Q digest` (it posts the daily Decisions digest of design questions when one is due), then
comment once on the sprint log issue (`docs/sprint.md`, Machinery), under 15 lines: the lane, the time, one line
per task (#issue, merging, held or blocked, pull request link), each rail hold, and why you stopped. Questions go
to the owner only through the digest. The owner reads it on their phone: those items and nothing else. Then run
`git worktree prune`.
