---
name: sprint-stop
description: End the sprint's window now and switch its supervisor off; sessions already running finish their task. Run only as /sprint-stop.
disable-model-invocation: true
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
You end the sprint in `docs/sprint.md` now, in the main checkout. `Q` below is `node tools/sprint/queue.mjs`.
Your last message starts with exactly one of `STOPPED terminal-dusk at <end>` or
`NOT RUNNING terminal-dusk: <state from Q window>`, then at most 6 lines.

1. `Q window`. Unless it says `open`, reply `NOT RUNNING` and stop.
2. `Q window stop`: the window ends now. Every lane's `next` is `null` from here, so each running lane session
   finishes the task in hand and stops.
3. `RemoteTrigger` `update` the window's `supervisor` id with `{"enabled": false}` (load RemoteTrigger with
   ToolSearch). Leave the archiver: it switches itself off once no sprint session is left running.
4. `Q sessions`: `RemoteTrigger` `get` each id. One that is enabled with a `run_once_at` still to come is a
   restart the supervisor scheduled after a usage limit: `update` it with `{"enabled": false}`.
5. `gh issue comment <log from Q window> --body "Sprint stopped at <end>. <the lane lines of Q status>"`.
