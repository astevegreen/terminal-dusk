---
name: sprint-plan
description: Writes specs for the next backlog items of one sprint lane, 20-22 October. Run only as /sprint-plan <lane>, from a session the sprint supervisor started.
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

Stop when `date -u +%Y%m%dT%H%M` is outside `20261021T0000` to `20261022T0600`, or the lane has 3 open
`sprint-ready` issues, or its backlog has no item left without an issue.

## 1. Pick
Read the lane's backlog in `docs/sprint.md`, top to bottom. An item is done when an issue title starts `[task] <ID>:` or `[task] <ID>` plus a letter and a colon
(a split part). Get every title once with `gh issue list --state all --search "[task] in:title" --limit 500 --json title`
and match the start of the title yourself; GitHub search matches whole words, so `R4` does not find `R4a`.
R1-R3 are done; their issues still need step 4 and step 5 while they have `spec-review` (step 5 removes it).
Take the first item that is not done. Read only what its spec needs: `docs/repo-map.md`, the design files it
names, the related decisions in `docs/architecture.md`, and the code files the Explore agent points you to.

## 2. Check it can be specified
If the item needs a game-design choice that is not written in `docs/design/`, `docs/design/cards/`,
`docs/architecture.md` or `docs/sprint.md` (see "What still stops a task"), create the issue with the Goal and
one question, label it `L` and `blocked`, and go to the next item.

## 3. Write
Create each issue with the task form fields: Goal, Read first (exact paths and sections), Acceptance criteria
(testable statements), Out of scope, Size, Model, Depends on. Title `[task] <ID>: <what it does>`.
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

When you stop, comment once on issue #2 "Night shift log": the lane, the issues created (link, ID, ready or
blocked), and every assumption you made. Under 10 lines.
