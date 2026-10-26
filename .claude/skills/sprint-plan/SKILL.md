---
name: sprint-plan
description: Writes specs for the next backlog items of one lane of the sprint in docs/sprint.md. Run only as /sprint-plan <lane>, from a session the sprint supervisor started, or by the owner on the planning day.
disable-model-invocation: true
argument-hint: "<rules|app|online|research>"
model: opus
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
You turn the next backlog items of lane `$ARGUMENTS` in `docs/sprint.md` into issues the lane coordinator can
build. Owner permission 1 in that file approves the backlog, so you do not wait for the owner. You never edit
files, write code, or invent game rules. `L` below is the label `lane:$ARGUMENTS`.

`node tools/sprint/queue.mjs backlog $ARGUMENTS` prints `ready` (the lane's open `sprint-ready` issues), `target`
(3 while the window is open, 6 outside it: the planning day) and `todo` (its backlog IDs with no issue yet, in backlog order; an
ID is done once an issue for it or one of its lettered parts exists). If it prints an `error` or no JSON, stop
and report the error in your log comment.

`node tools/sprint/queue.mjs window` says whether the window is `open`; anything else is the planning day.
Stop when `ready` has reached `target`, or `todo` has no item left to take.

## 1. Pick
Run `backlog` (above) and read each `todo` item's line in `docs/sprint.md`.
Take the first `todo` item, skipping one with an unanswered question on "Sprint questions" (step 2).
Read only what its spec needs: `docs/repo-map.md`, the design files it
names, the related decisions in `docs/architecture.md`, and the code files the Explore agent points you to.

## 2. Check it can be specified
First read the "Sprint questions" issue (`docs/sprint.md`, Planning day): an `astevegreen` comment there that
answers a question by number settles it, like a line of `docs/design/`.
If the item needs a game-design choice that is not written in `docs/design/`, `docs/design/cards/`,
`docs/architecture.md`, `docs/sprint.md` (see "What still stops a task") or those answers:
- on the planning day: comment it on "Sprint questions" (create that issue if it is missing)
  as `Q<next number> <ID>: <question>`, with options and a recommended answer. File nothing for the item yet,
  and go to the next item.
- while the window is open: create the issue with the Goal and one question, label it `L` and `blocked`, and go to
  the next item.

A bug item: check it still happens on today's `origin/main`. Run its repro steps when it has them; otherwise
search `git log` since the report for a fix that names it. Put what you found in the spec. Already fixed:
create its issue with that finding and close it with `--reason "not planned"`. Not checkable without new code:
say "unverified" in the Goal, so the implementer's failing test decides.

## 3. Write
Create each issue with the task form fields: Goal, Read first (exact paths and sections), Acceptance criteria
(testable statements), Out of scope, Size, Model, Depends on. Title `[task] <ID>: <what it does>`. Read the
acceptance criteria back once and remove any two that contradict each other.
Size each for one fresh session: about 300 changed lines at most, one package where possible. Split bigger
items into `<ID>a`, `<ID>b` and so on, each provable on its own, with "Depends on" between them.
Name a code-owned path (`.github/CODEOWNERS`) in the Goal when the task must touch one. Label each `L`.

## 4. Audit
Run `node tools/gemini-audit.mjs specs <issue numbers>`. It prints nothing; read its findings from each
issue's comments. For each point: apply it by editing the issue body when it is valid and inside the backlog
item; otherwise comment why not. A point that needs a design choice makes the issue `blocked` (step 2).
If the audit fails, comment that on the issue and continue.

## 5. Release
For each issue without `blocked`: `gh issue edit <n> --add-label sprint-ready --remove-label spec-review`.
A blocked issue never gets `sprint-ready`; remove its `spec-review` too, so it is audited only once. Then go back to step 1.

When you stop, comment once on the sprint log issue (`docs/sprint.md`, Machinery): the lane, the issues created (link, ID, ready or
blocked), and every assumption you made, and nothing else. Under 10 lines: the owner reads it on their phone.
