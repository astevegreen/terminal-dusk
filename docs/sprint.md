# Sprint: the W7 rules and online play

**Window (UTC):** none in this file. `/sprint-start [hours]` opens it on this computer when the owner cues the
sprint (38 hours unless told otherwise), and `/sprint-stop` ends it early. `node tools/sprint/queue.mjs window`
prints it, in UTC and Eastern, and every sprint skill asks it rather than reading a date here. It lives in
`sprint-window.json` in the git folder every worktree shares, so a cue never waits for a pull request. There is
no extend command: let it end, or stop it, and cue a new one.

Inside the window this file overrides `docs/workflow.md`, the `night-shift` and `plan-tasks` skills, and the
"wait for the owner" steps in `CLAUDE.md`, wherever they conflict. Outside it, this file is inactive.

**Goal:** a window (38 hours unless the cue says otherwise) with no owner input, without lowering quality: every change still has tests, passes
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
4. No hour limit and no cap on the sprint's tasks: a lane session stops after 6 and the supervisor starts a
   fresh one the next hour. Up to four lanes run at once, one coordinator per lane.
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
  how the AI plays a missed online turn; whose bonuses apply to a draw from the rival's deck; whether the
  intervention and realign formulas are what the owner wants (`map-and-points.md`, "Still to confirm" and owner
  question 4); and every number `map-and-points.md` marks "open".
- Every hard rule and "Never" in `CLAUDE.md`, every hook, deny rule and Locked path.
- Code-owned paths (`.github/CODEOWNERS`: migrations, `package.json`, lockfile, configs, golden replays) still
  need the owner's approval on GitHub. The owner checks about twice a day while the window is open, morning
  and evening Eastern.
  Keep such changes in as few, small pull requests as possible, open them early, and build other work so it
  does not wait for them. R16 changes the golden replays; O11 adds a migration.
- In lane `online` only, a task whose dependency is an open pull request that waits only for the owner's
  approval may stack on it: the coordinator tells the implementer `Stack on: task/<dep>`. In lane `rules`, put
  R16's golden-replay change where later tasks don't depend on it, so the lane keeps building while it waits.

## Lanes

Each open sprint issue and pull request carries exactly one lane label. One coordinator runs per lane.
The queue's rules (whether a session has work, what a lane does next, how labels move, the status block) live
once in `tools/sprint/queue.mjs`, which reads the lanes, backlog and environment from this file as `origin/main`
has it, and the window from this computer. The supervisor, lanes and night shift ask it rather than spelling
the rules out.

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
  `packages/engine/src/stack.ts` and `types.ts`. Probably R16a place, R16b intervene, R16c realign. Intervene
  and realign wait for the owner's answer on their formulas (`map-and-points.md` question 4), which the planning
  day asks, so R16a goes first. The golden replays change: one code-owned pull request, opened early.
- **R17** Escalation: the track and its levels, +1 for each intervention in a battleground, -1 at turn end,
  one more region closed to interventions and realignments at each of 3, 4 and 5, staying closed as the track
  rises (which ones is scenario data), and the crisis at 6 as far as it is decided (its score waits for scoring).
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
  and which regions close at Escalation 3, 4 and 5, in what order (owner question 3 in `map-and-points.md`).
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

- **The cue:** in a session in the main checkout, on `main` with this file merged, the owner (or the root
  `/sprint-cue` on this computer) runs `/sprint-start [hours]`. It asks nothing. It checks the computer, opens
  the window, makes the supervisor and the archiver, fires the supervisor once and posts on the sprint log.
  Its last message starts `STARTED terminal-dusk window <start>Z–<end>Z` or `REFUSED terminal-dusk: <reason>`.
  `/sprint-start --dry-run` runs every check and read, writes nothing, and ends `DRY-RUN OK terminal-dusk` or
  `DRY-RUN FAIL terminal-dusk: <items>`. `/sprint-stop` ends the window now and switches the supervisor off;
  the archiver switches itself off once no sprint session is left running. A new `/sprint-start` waits until
  it has.
- **Environment:** `env_01Qq41L677xykRpHYXs2FnXL`: the computer every sprint session runs on. `queue.mjs env`
  reads it from here, and the supervisor starts sessions with it. Environment ids change when the sprint moves
  to another computer, so this line is the only place that names it.
- **Supervisor:** "Sprint supervisor", made by `/sprint-start` with the remote `create_trigger` tool, runs
  `.claude/skills/sprint-supervisor` in a fresh session at minute 2 of every hour. Its id is kept with the
  window (`queue.mjs window` prints it), and after the window it switches itself off by that id. A trigger made
  with `create_trigger` can be changed by any agent later; one made through the HTTP API only by its own runs or
  the owner.
- It starts `Sprint lane: <lane>` sessions (`.claude/skills/sprint-lane`) and `Sprint plan: <lane>` sessions
  (`.claude/skills/sprint-plan`), records each trigger's id (`queue.mjs started`) and finds them again by that
  id (`queue.mjs sessions`), never in `RemoteTrigger list`, which shows only the account's newest 20. It
  restarts any that stopped; after a usage limit, at 2 minutes past the reset the error names
  (`queue.mjs resume` gives that time as `restartAt`).
- **Archiver:** "Sprint archiver", made by `/sprint-start`, posts into one session at minute 50 of every hour:
  its own session on Haiku 5.5 (`claude-haiku-5-5`), made with `create_session`, or the start session when
  that fails (the cue says which). `list_sessions` leaves out the sessions triggers start, so it works from the
  ids the supervisor recorded. Every run lands in the same conversation and re-reads the ones before it (YODC's
  archiver used 12.9 M tokens in 25 hours in October), so its prompt is short, and an archive can be undone
  (`unarchive_session`). Exactly this prompt:
  ```
  Sprint archiver. In the main checkout, use only Bash for `node tools/sprint/queue.mjs`, RemoteTrigger
  (list_runs and update) and archive_session; load them with ToolSearch if they are not listed.
  1. `node tools/sprint/queue.mjs window`, then `node tools/sprint/queue.mjs sessions --all`: the
     supervisor's id and the ids of the triggers it started this sprint.
  2. RemoteTrigger list_runs on each id. Archive each run that is not this session and is finished (not
     running, last event over 60 minutes ago) or stuck (running with no event in 60 minutes, or waiting
     for an answer for 30). Leave every other run.
  3. When the window says "after" and no run is left running, RemoteTrigger update its archiver id with
     {"enabled": false}, then run `node tools/sprint/queue.mjs window archived`.
  Reply with one line: "Archived <n>: <titles>" (mark stuck ones "(stuck)"), or "Archived 0".
  ```
- Progress and questions go to the sprint log, issue `#290`: an issue for this sprint alone, not #2, which the
  night shift shares. (It is not pinned yet: GitHub allows three pinned issues, and #2, #3 and #4 hold them.)
  Its body is the status block, which the supervisor rewrites every hour; comments hold the history.
- The night shift builds nothing while the window is open: `queue.mjs next night` prints `null` inside it, and
  the night-shift skill checks the window before anything else. A task it was already building finishes;
  `/sprint-start` names it (`queue.mjs night-shift`).
- Other projects' sprints may run on this computer at the same time (relayed 24 Oct; approving this pull
  request confirms it), their supervisors at minutes 22 and 42. They share the computer's memory, so the
  supervisor keeps 1.5 GB back for each session it has already started that run (`has-work --started`), and
  they share the account's usage limit, so one usage-limit stop can halt every lane at once (21 Oct, 02:11 UTC).

## What we measure (agent practices review, 23 Oct, items 6 and 7)

Claude writes these on the sprint log the morning after the window, next to October's where known:

- **Empty starts:** lane sessions that started and found no job. Target 0.
- **Supervisor tokens per run**, and **archiver tokens per day** (October's: 12.9 M in 25 hours).
- **Status requests:** how often the owner had to ask how it was going. The status block should answer it.
- **Reviewer misses:** bugs found after a merge in code a reviewer passed. Each one becomes an eval case (X9).
- **Stack tests run:** online pull requests whose local Supabase tests ran, against those that skipped them
  (October: 8 skipped).
- **Time-outs:** test runs that failed on a time limit and passed on a rerun (October: 5).

## Planning day (before the cue)

- The owner runs `/sprint-plan <lane>` for each lane, one after another. Plan sessions spec each lane's first 6
  issues. Every design question goes in one issue, "Sprint questions": one numbered question per comment, with
  options and a recommended answer. The owner answers them in one sitting before the cue, by number; plan
  sessions then file the items those answers settle.
- The reserve items are part of the backlog above, so approving this file approves them.
- During the window, a new question goes on its task issue as usual, since lanes look for the answer there.
  The status block links it under "Needs you".

## Preflight

The owner, before the cue:

1. GitHub Actions: the budget has room for about 300 more runs (this repository is private, and its Windows
   job counts double).
2. The "Sprint questions" issue is answered (Planning day).
3. Claude Code is 2.1.304 or later, both the `claude` on PATH (`claude --version`) and the copy the desktop app
   bundles. Lanes send a reviewer's concerns back to the implementer that built the task (`SendMessage`), and
   before 2.1.304 a resumed subagent could forget its latest work. Auto-update is off on this computer
   (`autoUpdates: false`, and the desktop app sets `DISABLE_AUTOUPDATER=1`): the owner updates by hand, with
   `claude update` and the desktop app's own update.
4. `/sprint-start --dry-run` ends `DRY-RUN OK terminal-dusk`.

`/sprint-start` checks the rest itself. It refuses when one of the first three fails, and otherwise starts and
names what is short:

5. The main checkout is on `main`, clean and up to date, with this file and `tools/sprint/cue.mjs` on it.
6. The Environment id in Machinery is listed by `list_environments`, and `queue.mjs env` prints it.
   (October's laptop id had disappeared by 24 Oct.)
7. No window is open already.
8. At least 30 GB of free disk and 8 GB of free memory; fewer than 10 sessions on the rc host.
9. Docker is running and the local Supabase stack starts, so the online lane's stack tests run (in October they
   skipped in 8 pull requests).
10. The night shift's task in flight, if any (`queue.mjs night-shift`): it finishes, and builds nothing more.

A test that times out during the window is rerun once before anyone blames the code: the computer is shared.

## Turning it off

- Stop: `/sprint-stop` ends the window now and switches the supervisor off. Running sessions finish their
  current task, and the archiver switches itself off once none is left.
- Afterwards: one pull request deletes this file, `.claude/skills/sprint-*`, the sprint lines in the `implement-issue`
  and `night-shift` skills and the `reviewer` agent, and deletes the `lane:*` and `sprint-ready` labels.
