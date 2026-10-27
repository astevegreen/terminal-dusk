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
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/no-plugin-writes.mjs"
          timeout: 10
---
You end the sprint in `docs/sprint.md` now, in the main checkout. `Q` below is `node tools/sprint/queue.mjs`.
Your last message starts with exactly one of `STOPPED terminal-dusk at <end>` or
`NOT RUNNING terminal-dusk: <state from Q window>`, then at most 6 lines the owner can read on a phone.

1. `Q window`. Unless it says `open`, reply `NOT RUNNING` and stop.
2. `Q window stop`: the window ends now, and it records `stoppedBy: sprint-stop`, so the supervisor reports the
   stop as the owner's, not as a fault. Every lane's `next` is `null` from here, so each running lane session
   finishes the task in hand and stops.
3. `update_trigger` (claude-code-remote; load it with ToolSearch) the window's `supervisor` id with `enabled`
   `false`, then its `wake` id the same way when it is not null: the wake is the supervisor's one-shot restart
   after a usage limit. Both are made with `create_trigger`, so `update_trigger` can change them.
   When either is refused, add the line "switch the <supervisor|wake> off at
   https://claude.ai/code/routines/<id>". Until then their runs stop at their window check. Leave the archiver:
   it switches itself off once no sprint session is left running.
4. `Q sessions`: `RemoteTrigger` `get` each id (load RemoteTrigger with ToolSearch; the supervisor makes these
   through it, so only `RemoteTrigger` can change them). One that is enabled with a `run_once_at` still to come is a
   restart the supervisor scheduled after a usage limit: `update` it with `{"enabled": false}`.
5. `gh issue comment <log from Q window> --body "Sprint stopped at <end>. <the lane lines of Q status>"`.
   Comment only with `gh issue comment`, signed in as the bot; never with the GitHub plugin's tools, which sign
   in as the owner, so GitHub never notifies the owner and the queue could read the comment as the owner's.
