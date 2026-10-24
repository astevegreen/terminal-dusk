# Sprint: 20–22 October 2026

**Window (UTC):** `20261021T0000` to `20261022T1400` (Tue 20 Oct 20:00 to Thu 22 Oct 10:00, Eastern).
Check with `date -u +%Y%m%dT%H%M`. Every sprint skill reads the window from this line, and nothing else holds
it: to extend the sprint, change this line. The owner extended the end from 02:00 to 10:00 Eastern on 22 Oct.

Inside the window this file overrides `docs/workflow.md`, the `night-shift` and `plan-tasks` skills, and the
"wait for the owner" steps in `CLAUDE.md`, wherever they conflict. Outside it, this file is inactive.

**Goal:** use the plan's usage fully for 38 hours with no owner input, without lowering quality: every
change still has tests, passes `pnpm gate`, and gets a reviewer pass.

## Owner's standing permissions (20 Oct, in the session that set up the sprint)

1. The backlog below is an approved task list. `sprint-plan` writes and creates its specs without asking.
2. Claude applies the valid Gemini audit points itself and adds `sprint-ready` to sprint issues
   (the desktop night shift reads only `ready` and skips `lane:*` pull requests, so it leaves sprint work alone).
3. Implementer and reviewer run on Opus for every task.
4. No hour limit and no task cap. Up to four lanes run at once, one coordinator per lane.
5. Phase 4 (online play) may start now, before the phase 3 gate in the build order of `docs/architecture.md`.
6. Cards may be rebuilt to their approved design lines (`docs/design/cards/era-*.md`) without a separate check.
7. #84 may edit `tools/gates/` (approved). The implementer's file lock still blocks that path, so #84 stays
   for a day session; the sprint does not touch it.

## What still stops a task (unchanged)

- Never invent game rules. A task that needs a design choice not written in `docs/design/`,
  `docs/design/cards/`, `docs/architecture.md` or this file: comment one question on the issue, starting
  `Blocked:` (only then does the owner's next comment count as the answer), label it `blocked`, and move to the next task. Open design points include W7 (map, influence, tension, scoring), the
  sides' special abilities, era lengths, and whose modifiers apply to a draw from the rival's deck.
- Every hard rule and "Never" in `CLAUDE.md`, every hook, deny rule and Locked path.
- Code-owned paths (`.github/CODEOWNERS`: migrations, `package.json`, lockfile, configs, golden replays) still
  need the owner's approval on GitHub. The owner checks at about 06:00 and 19:00 on Wednesday. Keep such
  changes in as few, small pull requests as possible, and build other work so it does not wait for them.
- In lane `online` only, a task whose dependency is an open pull request that waits only for the owner's
  approval may stack on it: the coordinator tells the implementer `Stack on: task/<dep>`.

## Lanes

Each open sprint issue and pull request carries exactly one lane label. One coordinator runs per lane.
The queue's rules (whether a session has work, what a lane does next, how labels move, the status block) live
once in `tools/sprint/queue.mjs`, which reads the window, lanes and backlog from this file. The supervisor,
lanes and night shift ask it rather than spelling the rules out.

| Lane       | Label           | Where it works                                                              |
| ---------- | --------------- | --------------------------------------------------------------------------- |
| `rules`    | `lane:rules`    | `packages/engine`, `packages/content` (cards, schemas)                      |
| `app`      | `lane:app`      | `packages/app` (not `transport/`), `packages/host`, `packages/ai`, `tests/` |
| `online`   | `lane:online`   | `packages/server`, `packages/app/src/transport/`                            |
| `research` | `lane:research` | `tools/balance/`, `docs/proposals/`                                         |

## Backlog

Issue titles start `[task] <ID>: `, so anyone can see which items have specs. Work in this order inside a lane.
An item too big for about 300 changed lines becomes `<ID>a`, `<ID>b`, and so on.

### rules

- **R1** #130, **R2** #131, **R3** #117 (already written and tagged; fold in their Gemini audits, then `sprint-ready`).
- **R4** W1+W3 from `docs/design/cards/deck-plan.md` "Engine wish list": a marker that lasts beyond the turn, and
  a Condition `{ op: "has", marker }` that tests it. Engine, schema, fuzz ruleset coverage.
- **R5** W5: a Condition on who played the card.
- **R6** W8: a step that discards from, or peeks at, a hand (hidden cards stay in their compartment).
- **R7** W2: a trigger scoped to one side's plays, or that fires once.
- **R8** W6: remove a card from the game (once-only events).
- **R9** Neutral cards use Contingency draws, as their design lines say (owner follow-up, 19 Oct). One task per era.
- **R10** Side cards whose design lines draw from the rival's deck (owner follow-up, 19 Oct).
- **R11** Cards marked W1 or W3: build their marker chains, as their design lines say. One task per era.
- **R12** Cards marked W5 (hot cards), W8 (espionage) and W2 (Dot-com, Golden Shield, The Leaks).
  For W2, follow the design line and list any rules-text change under "Unsure" (owner question 16).
- **R13** Cards marked W6: the Ops 4 once-only events.

### app

- **A1** The yes/no prompt shows the card's question, not only "yes or no?".
- **A2** Easy AI and its tests handle each new step and condition from R4–R8 (one task as they merge).
- **A3** Real findings from the Gemini weekly audit (#3) and the "How the code is organised" page (#4), one task each.
- **A4** Open SonarCloud findings on `main`. `node tools/sonar.mjs <pr>` lists a pull request's findings; GitHub gets at most about 50 of them, so the full list for `main` needs the owner's SonarCloud sign-in.
- **A5** Accessibility of the game screen: labels, focus order and keyboard play, phone first, no new look.
- **A6** Playwright smoke tests for the replay viewer and a full AI game to the end screen.

### online (architecture Decision 5; build-order phase 4)

There is no Supabase project yet (owner, 20 Oct). Build and test only against the local Supabase CLI and in-memory
fakes: no hosted project, no project keys, no deploy steps. A test that needs the local stack skips with a clear
message when it isn't running, and the pull request says so.

- **O1** Server: the submit handler as plain TypeScript behind a storage port (load match, check seat and
  version, `hostSubmit`, write record and frames together), with an in-memory store and tests. No new dependency.
- **O2** Server: the read model. What each seat and a spectator may read; tests prove no secret or other side's
  private field reaches a client-readable row.
- **O3** Supabase: migration for match tables and read rules, plus the Supabase config and dependency. One
  code-owned pull request; open it early so the owner can approve it Wednesday morning.
- **O4** The Supabase Edge Function for `submit` that calls O1.
- **O5** Private games: create and join by invite code.
- **O6** App: a remote transport that implements `MatchTransport` over Supabase; platform pieces stay behind Platform.
- **O7** Deadlines: the two decided rules (loss on time; one grace extension, then loss on time). The "AI plays
  the missed turn" rule is not decided and stays out of scope.
- **O8** Email sign-in codes and email turn alerts, with the mail provider behind an interface (no secrets in code).
- **O9** Entitlements in the match host: free players cannot create online games or play ranked (product calls).
  The one `packages/host` task in lane `online`; the app lane's backlog has no host task, so they don't overlap.

### research

- **X1** `tools/balance/`: run many seeded Easy-vs-Easy games on the first-deck scenario, report win rate by side
  and per-card play and win statistics. Run with `node tools/balance/...`; do not add a `package.json` script.
- **X2** Proposal: options for the map, influence, tension track and scoring (W7). `docs/proposals/`.
- **X3** Proposal: options for LIO's and SAE's special abilities.
- **X4** Proposal: era lengths and turns per era, using X1's numbers.
- **X5** Proposal: options for the LIO/SAE card-count gap and the missing Era 3 LIO Ops 4 card (owner question 17).

A proposal lays out two or three options with trade-offs and decides nothing. Its first line says
"Proposal, not a rule". No names, art or text from Twilight Struggle.

## Machinery

- One supervisor trigger, "Sprint supervisor", id `trig_…` (filled in at setup), runs
  `.claude/skills/sprint-supervisor` on the owner's laptop at minute 2 of every hour from the evening before.
  Outside the window its first step stops it; after the window it switches itself off by this id. It is
  created from a session the owner started (desktop app or `claude rc`) with the remote `create_trigger` tool,
  so any agent can edit it later: a trigger made through the HTTP API can be changed only by its own runs or by
  the owner.
- It starts `Sprint lane: <lane>` sessions (`.claude/skills/sprint-lane`) and `Sprint plan: <lane>` sessions
  (`.claude/skills/sprint-plan`), and restarts any that stopped, for example after a usage limit.
- The sprint archiver: an hourly scheduled task at minute 50 that posts into a session the owner started
  (`claude rc` or the desktop app), because scheduled sessions have no `archive_session`. It archives finished
  sessions after an hour, and stuck ones (no event in 60 minutes, or 30 minutes waiting for an answer). It is on
  before the window opens, and the dry run proves it: one finished session archived, its process gone.
  Every run lands in the same conversation and re-reads all the runs before it (YODC's archiver used 12.9 M
  tokens in 25 hours in October), so it runs lean:
  - a fresh session each sprint day, which the owner starts; the schedule fires into the session it was set up
    with, so set up each day's session and schedule on the planning day, or re-point the schedule each morning;
  - on Haiku 5.5 (`claude-haiku-5-5`), or Sonnet at low effort: archiving is a list, a filter and a call, and
    an archive can be undone (`unarchive_session`);
  - with exactly this prompt:
    ```
    Sprint archiver. Use only the claude-code-remote tools list_sessions and archive_session (load them with
    ToolSearch if they are not listed).
    1. list_sessions with limit 50.
    2. Archive each session where environment_id is env_01NzJ5sYBdPtRrLcXKYr7zTM, origin is scheduled_trigger,
       it is not this session, and one of these holds:
       - finished: session_status is not RUNNING, status_bucket is COMPLETED, REVIEW_READY or FAILED, and
         updated_at is over 60 minutes ago;
       - stuck: session_status is RUNNING and updated_at is over 60 minutes ago, or status_bucket is BLOCKED
         and updated_at is over 30 minutes ago.
    3. Every other session stays as it is. The API prefixes these values (SESSION_STATUS_RUNNING,
       SESSION_STATUS_BUCKET_COMPLETED).
    Reply with one line: "Archived <n>: <titles>" (mark stuck ones "(stuck)"), or "Archived 0".
    ```
  - Measure its tokens per day (the session's usage), against October's.
- Progress and questions go to the sprint log, issue `#<n>` (filled in at setup): a pinned issue for this sprint
  alone, not #2, which the night shift shares. Its body is the status block, which the supervisor rewrites
  every hour; comments hold the history.
- One sprint per computer (owner, 22 Oct): no other project's sprint or soak runs on this computer during the
  window. A sprint on another computer still shares the account's usage limit, so one usage-limit stop can halt
  both at once (21 Oct, 02:11 UTC); the supervisor restarts the lanes after it.

## Planning day (the day before the window)

- The owner runs `/sprint-plan <lane>` for each lane, one after another. Plan sessions spec each lane's first 6
  issues. Every design question goes in one issue, "Sprint questions": one numbered question per comment, with
  options and a recommended answer. The owner answers them in one sitting before the window opens, by number;
  plan sessions then file the items those answers settle.
- The reserve backlog (what the lanes take when the main one runs dry) is proposed and approved the same day.
- During the window, a new question goes on its task issue as usual, since lanes look for the answer there.
  The status block links it under "Needs you".

## Preflight (Claude runs it the evening before; the owner fixes what it finds)

1. GitHub Actions: the budget has room for about 300 more runs.
2. This computer: at least 30 GB of free disk and 8 GB of free memory; fewer than 10 sessions on the rc host
   (archive the rest).
3. The sprint archiver is on, and the dry run proved it (Machinery).
4. The supervisor trigger exists, its id is in Machinery, and the dry run showed an agent can switch it off.
5. No other project's sprint or soak runs on this computer during the window (Machinery).
6. The "Sprint questions" issue is answered and the reserve backlog approved (Planning day).
7. Browser tests run with one worker for the sprint (set in the lane prompt, not in the test config).
8. The night shift's scheduled task is paused.
9. Claude Code is 2.1.304 or later, both the `claude` on PATH (`claude --version`) and the copy the desktop app
   bundles. Lanes send a reviewer's concerns back to the implementer that built the task (`SendMessage`), and
   before 2.1.304 a resumed subagent could forget its latest work. Auto-update is off on this computer
   (`autoUpdates: false`, and the desktop app sets `DISABLE_AUTOUPDATER=1`): the owner updates by hand, with
   `claude update` and the desktop app's own update.

## Turning it off

- Pause: disable the supervisor trigger (its id is under Machinery). Running sessions finish their current task.
- Afterwards: one pull request deletes this file, `.claude/skills/sprint-*`, the sprint lines in the `implement-issue`
  and `night-shift` skills and the `reviewer` agent, and deletes the `lane:*` and `sprint-ready` labels.
