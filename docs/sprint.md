# Sprint: 27–29 October 2026

**Window (UTC):** `20261028T0000` to `20261029T1400` (Tue 27 Oct 20:00 to Thu 29 Oct 10:00, Eastern).
Check with `date -u +%Y%m%dT%H%M`. Every sprint skill reads the window from this line, and nothing else holds
it: to extend the sprint, change this line. Eastern is still daylight time (UTC-4) until 1 November.

Inside the window this file overrides `docs/workflow.md`, the `night-shift` and `plan-tasks` skills, and the
"wait for the owner" steps in `CLAUDE.md`, wherever they conflict. Outside it, this file is inactive.

**Goal:** 38 hours with no owner input, without lowering quality: every change still has tests, passes
`pnpm gate`, and gets a reviewer pass. What it should leave behind:

- **rules:** the decided part of W7 built in the engine: the map as scenario data, influence and control, the
  action menu (place, intervene, realign) and the Escalation track (`docs/design/map-and-points.md`).
- **app and online:** online play end to end on the local stack: sign in, create or join a private game, play
  it, deadlines and turn alerts run by the server's schedule, and a rehearsal of the phase 4 gate.
- **research:** options for what W7 still leaves open (the map's content, the tech race), the AI's missed
  online turn, and a reviewer eval with 10 cases.

## Owner's standing permissions (proposed 24 Oct; they hold once the owner approves this pull request)

1. The backlog below is an approved task list. `sprint-plan` writes and creates its specs without asking.
2. Claude applies the valid Gemini audit points itself and adds `sprint-ready` to sprint issues
   (the desktop night shift reads only `ready` and skips `lane:*` pull requests, so it leaves sprint work alone).
3. Implementer and reviewer run on Opus for every task.
4. No hour limit and no task cap. Up to four lanes run at once, one coordinator per lane.
5. Phase 4 (online play) continues before the phase 3 gate in the build order of `docs/architecture.md`.
6. The rules lane builds what `docs/design/map-and-points.md` decides. Anything it marks "open" is a question,
   never a guess: the planning day asks it, and the build waits for the answer or works on a test map.
7. Card design notes in `docs/design/cards/` may be corrected where they contradict a decision already recorded
   there or in `docs/design/` (R19). Each correction is listed under "Unsure" in its pull request.

## What still stops a task (unchanged)

- Never invent game rules. A task that needs a design choice not written in `docs/design/`,
  `docs/design/cards/`, `docs/architecture.md` or this file: comment one question on the issue, starting
  `Blocked:` (only then does the owner's next comment count as the answer), label it `blocked`, and move to the
  next task. Open design points include: the real map's countries, regions, adjacency, stabilities and
  battlegrounds; scoring; the tech race track; the sides' special abilities; era lengths and plays per turn;
  how the AI plays a missed online turn; whose bonuses apply to a draw from the rival's deck; and every number
  `map-and-points.md` marks "open".
- Every hard rule and "Never" in `CLAUDE.md`, every hook, deny rule and Locked path.
- Code-owned paths (`.github/CODEOWNERS`: migrations, `package.json`, lockfile, configs, golden replays) still
  need the owner's approval on GitHub. The owner checks at about 06:00 and 19:00 Eastern on Wednesday 28 Oct.
  Keep such changes in as few, small pull requests as possible, open them early, and build other work so it
  does not wait for them. R16 changes the golden replays; O11 adds a migration.
- In lane `online` only, a task whose dependency is an open pull request that waits only for the owner's
  approval may stack on it: the coordinator tells the implementer `Stack on: task/<dep>`. In lane `rules`, put
  R16's golden-replay change where later tasks don't depend on it, so the lane keeps building while it waits.

## Lanes

Each open sprint issue and pull request carries exactly one lane label. One coordinator runs per lane.
The queue's rules (whether a session has work, what a lane does next, how labels move, the status block) live
once in `tools/sprint/queue.mjs`, which reads the window, lanes, backlog and environment from this file. The
supervisor, lanes and night shift ask it rather than spelling the rules out.

| Lane       | Label           | Where it works                                                              |
| ---------- | --------------- | --------------------------------------------------------------------------- |
| `rules`    | `lane:rules`    | `packages/engine`, `packages/content` (cards, schemas, scenarios)           |
| `app`      | `lane:app`      | `packages/app` (not `transport/`), `packages/host`, `packages/ai`, `tests/` |
| `online`   | `lane:online`   | `packages/server`, `packages/app/src/transport/`                            |
| `research` | `lane:research` | `tools/balance/`, `tools/eval/`, `docs/proposals/`                          |

## Backlog

Issue titles start `[task] <ID>: `, so anyone can see which items have specs. Work in this order inside a lane.
An item too big for about 300 changed lines becomes `<ID>a`, `<ID>b`, and so on. Items marked "reserve" are
what a lane takes when the rest is done or blocked.

### rules

All of it follows `docs/design/map-and-points.md`. The real map's content is open, so R14 adds a small test map
for tests and fuzz, and every number the file marks "open" is scenario data, not code.

- **R14** The map as scenario data: regions, countries with stability and a battleground flag, adjacency, the
  two home boxes and the countries next to them. Schema, `pnpm content:check`, the test map, and influence in
  the public compartment of the state and views.
- **R15** Influence and control: the control rule, placing (1 point per influence where the side has influence,
  next to it, or next to its home box; 2 per influence in a country the rival controls), every removal stopping
  at 0, and a fuzz invariant that influence is never negative.
- **R16** The action menu: a card played for points, and every `spendPoints` step, spends its points on place,
  intervene or realign. This replaces the TEMPORARY "spending points only says so" in
  `packages/engine/src/stack.ts` and `types.ts`. Probably R16a place, R16b intervene, R16c realign. The golden
  replays change: one code-owned pull request, opened early.
- **R17** Escalation: the track and its levels, +1 for each intervention in a battleground, -1 at turn end,
  regions closing to interventions and realignments at 3 and 4 (which ones is scenario data), and the crisis at
  6 as far as it is decided (its score waits for scoring).
- **R18** The sixteen cards that move Escalation by 1 (`map-and-points.md`, "Cards that move it"), once R17 is in.
- **R19** Leftovers from October: check `triggers.ts` afterProgram's player (`playsMade` or `inPlayBy`) and the
  neutralDraw test's out-of-date header (#165); correct the stale card notes at `era-1.md` 95 and 191,
  `era-2.md` 265 and `era-3.md` 150, 198 and 315 to the decisions already recorded (#176 #231 #237 #238 #241).
- **R20** (reserve) SonarCloud's findings in `packages/engine` and `packages/content`: about 20 `.sort()` calls
  with no compare function.

### app

- **A7** Sign in by email code, using `transport/emailAuth.ts` (built, but only tests use it).
- **A8** The online lobby: create a private game (its invite code and the deadline rule its creator picks), join
  by code, and list my games. A free player who tries to create one is told why (the server's `notEntitled`).
  Lobby choices not written down (such as deadline lengths) are planning-day questions.
- **A9** Play an online game through `transport/remoteMatch.ts`: whose turn it is, the deadline, and the
  screen updating when the rival moves. Includes the `clearTimeout` wrapper #263 asked for.
- **A10** Playwright: two browsers play a private game on the local stack to the end, and the test checks every
  network response for hidden data (the phase 4 gate). It skips, saying why, when the stack isn't running.
- **A11** Easy AI and its tests handle each new action and decision from R14–R17, one task as each merges.
- **A12** Leftovers from October: the AI's `guess.ts` counts the removed pile as seen (#213); the replay-archive
  test covers a draw into a hand (#102); Sonar's loop condition at `packages/ai/src/test/playEasy.ts:34`.
- **A13** (reserve) The map on screen, phone first (Decision 6): zoomed out, a badge per country with net
  influence in its controller's colour; zoomed into a region, boxes with stability and both sides' influence.
  It uses R14's test map until the real one is set.

### online (architecture Decision 5; build-order phase 4)

There is still no hosted Supabase project. Build and test only against the local Supabase CLI and in-memory
fakes: no hosted project, no project keys, no deploy steps. Docker and the local stack run for the whole window
(Preflight), so the stack tests run instead of skipping; a pull request whose stack tests did not run says so in
its first line.

- **O9** carries over: #283 (O9b, a migration: the owner's approval) and #284 (O9c, waits on #283).
- **O10** `accept_invite` writes the game's clock and next deadline (#260).
- **O11** The schedule: Edge Functions that run `sweepDeadlines` and `sweepTurnAlerts`, and the job that calls
  them (a migration). Whether the sweep re-checks an alert before marking it stale (#273) is a planning-day
  question.
- **O12** SonarCloud's findings in `packages/server`: the sort with no compare function at `invite.ts:128`,
  `test/errors.ts:5`, and the async functions with no `await`. These fail Sonar's quality gate on `main`.
- **O13** The phase 4 gate, rehearsed: 50 seeded online games played by Easy AI on both seats through `submit` on
  the local stack, checking that each client's frames match the server's and that no response carries a secret
  or the rival's private field. A short report per run.

### research

- **X6** Proposal: the six-region map's content: countries per region, adjacency, stabilities, battlegrounds,
  and which regions close first at Escalation 3 and 4 (owner question 3 in `map-and-points.md`).
- **X7** Proposal: the tech race track: branches, costs, what moving up gives, and its links to Escalation and
  Credibility (owner question 1).
- **X8** Proposal: how the AI plays a missed online turn when Decision 8 rules out an AI on the server
  (`docs/architecture.md`, "What happens when a deadline passes").
- **X9** The reviewer eval (`tools/eval/`): add cases from October's and this sprint's merges until there are
  10, each a real bug a reviewer passed or a clean change, and run it once. Its report goes on the sprint log.
- **X10** (reserve) Drafts, for the owner's approval like `new-lio-cards.md`: each card's rules text reworded now
  that points have a use (`map-and-points.md`, "Event points", question 7).
- **X11** (reserve) Once R16 is in, X1's balance tool on the test map, by side and by card (a smoke check only:
  the map is not the real one).

A proposal lays out two or three options with trade-offs and decides nothing. Its first line says
"Proposal, not a rule". No names, art or text from Twilight Struggle.

## Machinery

- **Environment:** `env_…` (filled in at setup): the computer every sprint session runs on. `queue.mjs env`
  reads it from here, and the supervisor starts sessions with it. Environment ids change when the sprint moves
  to another computer, so this line is the only place that names it.
- One supervisor trigger, "Sprint supervisor", id `trig_…` (filled in at setup), runs
  `.claude/skills/sprint-supervisor` on that computer at minute 2 of every hour from the evening before.
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
  - with exactly this prompt, its environment id the same as the Environment line above:
    ```
    Sprint archiver. Use only the claude-code-remote tools list_sessions and archive_session (load them with
    ToolSearch if they are not listed).
    1. list_sessions with limit 50.
    2. Archive each session where environment_id is env_…, origin is scheduled_trigger,
       it is not this session, and one of these holds:
       - finished: session_status is not RUNNING, status_bucket is COMPLETED, REVIEW_READY or FAILED, and
         updated_at is over 60 minutes ago;
       - stuck: session_status is RUNNING and updated_at is over 60 minutes ago, or status_bucket is BLOCKED
         and updated_at is over 30 minutes ago.
    3. Every other session stays as it is. The API prefixes these values (SESSION_STATUS_RUNNING,
       SESSION_STATUS_BUCKET_COMPLETED).
    Reply with one line: "Archived <n>: <titles>" (mark stuck ones "(stuck)"), or "Archived 0".
    ```
- Progress and questions go to the sprint log, issue `#<n>` (filled in at setup): a pinned issue for this sprint
  alone, not #2, which the night shift shares. Its body is the status block, which the supervisor rewrites
  every hour; comments hold the history.
- One sprint per computer (owner, 22 Oct): no other project's sprint or soak runs on this computer during the
  window. Proposed for this sprint: no games on it either, since a busy computer caused October's test
  time-outs. A sprint on another computer still shares the account's usage limit, so one usage-limit stop can
  halt both at once (21 Oct, 02:11 UTC); the supervisor restarts the lanes after it.

## What we measure (agent practices review, 23 Oct, items 6 and 7)

Claude writes these on the sprint log the morning after the window, next to October's where known:

- **Empty starts:** lane sessions that started and found no job. Target 0.
- **Supervisor tokens per run**, and **archiver tokens per day** (October's: 12.9 M in 25 hours).
- **Status requests:** how often the owner had to ask how it was going. The status block should answer it.
- **Reviewer misses:** bugs found after a merge in code a reviewer passed. Each one becomes an eval case (X9).
- **Stack tests run:** online pull requests whose local Supabase tests ran, against those that skipped them
  (October: 8 skipped).
- **Time-outs:** test runs that failed on a time limit and passed on a rerun (October: 5).

## Planning day (the day before the window)

- The owner runs `/sprint-plan <lane>` for each lane, one after another. Plan sessions spec each lane's first 6
  issues. Every design question goes in one issue, "Sprint questions": one numbered question per comment, with
  options and a recommended answer. The owner answers them in one sitting before the window opens, by number;
  plan sessions then file the items those answers settle.
- The reserve items are part of the backlog above, so approving this file approves them.
- During the window, a new question goes on its task issue as usual, since lanes look for the answer there.
  The status block links it under "Needs you".

## Preflight (Claude runs it the evening before; the owner fixes what it finds)

1. GitHub Actions: the budget has room for about 300 more runs.
2. This computer: at least 30 GB of free disk and 8 GB of free memory; fewer than 10 sessions on the rc host
   (archive the rest).
3. The sprint archiver is on, and the dry run proved it (Machinery).
4. The supervisor trigger exists, its id is in Machinery, and the dry run showed an agent can switch it off.
5. No other project's sprint or soak runs on this computer during the window (Machinery).
6. The "Sprint questions" issue is answered (Planning day).
7. Browser tests run with one worker for the sprint (set in the lane prompt, not in the test config).
8. The night shift's scheduled task is paused.
9. Claude Code is 2.1.304 or later, both the `claude` on PATH (`claude --version`) and the copy the desktop app
   bundles. Lanes send a reviewer's concerns back to the implementer that built the task (`SendMessage`), and
   before 2.1.304 a resumed subagent could forget its latest work. Auto-update is off on this computer
   (`autoUpdates: false`, and the desktop app sets `DISABLE_AUTOUPDATER=1`): the owner updates by hand, with
   `claude update` and the desktop app's own update.
10. The Environment id in Machinery is listed by `list_environments`, and `node tools/sprint/queue.mjs env`
    prints it. (October's laptop id had disappeared by 24 Oct.)
11. Docker is running and the local Supabase stack starts on this computer, so the online lane's stack tests
    run (in October they skipped in 8 pull requests).
12. On the idle computer, `pnpm fuzz:quick` finishes, and its time is noted on the sprint log. A test that
    times out during the window can then be told apart: a busy computer, or slow code.

## Turning it off

- Pause: disable the supervisor trigger (its id is under Machinery). Running sessions finish their current task.
- Afterwards: one pull request deletes this file, `.claude/skills/sprint-*`, the sprint lines in the `implement-issue`
  and `night-shift` skills and the `reviewer` agent, and deletes the `lane:*` and `sprint-ready` labels.
