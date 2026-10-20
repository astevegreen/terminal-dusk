# Sprint: 20–22 October 2026

**Window:** Tuesday 20 Oct 20:00 to Thursday 22 Oct 02:00, Eastern time
(UTC `20261021T0000` to `20261022T0600`). Check with `date -u +%Y%m%dT%H%M`.

Inside the window this file overrides `docs/workflow.md`, the `night-shift` and `plan-tasks` skills, and the
"wait for the owner" steps in `CLAUDE.md`, wherever they conflict. Outside it, this file is inactive.

**Goal:** use the plan's usage fully for 30 hours with no owner input, without lowering quality: every
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
  `docs/design/cards/`, `docs/architecture.md` or this file: comment one question on the issue, label it
  `blocked`, and move to the next task. Open design points include W7 (map, influence, tension, scoring), the
  sides' special abilities, era lengths, and whose modifiers apply to a draw from the rival's deck.
- Every hard rule and "Never" in `CLAUDE.md`, every hook, deny rule and Locked path.
- Code-owned paths (`.github/CODEOWNERS`: migrations, `package.json`, lockfile, configs, golden replays) still
  need the owner's approval on GitHub. The owner checks at about 06:00 and 19:00 on Wednesday. Keep such
  changes in as few, small pull requests as possible, and build other work so it does not wait for them.
- In lane `online` only, a task whose dependency is an open pull request that waits only for the owner's
  approval may stack on it: the coordinator tells the implementer `Stack on: task/<dep>`.

## Lanes

Each open sprint issue and pull request carries exactly one lane label. One coordinator runs per lane.

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
- **A4** Open SonarCloud findings on `main` (see the memory note on reading them via check-run annotations).
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

- An hourly scheduled task, "Sprint supervisor", runs `.claude/skills/sprint-supervisor` on the owner's laptop.
- It starts `Sprint lane: <lane>` sessions (`.claude/skills/sprint-lane`) and `Sprint plan: <lane>` sessions
  (`.claude/skills/sprint-plan`), and restarts any that stopped, for example after a usage limit.
- Progress and questions go to the pinned issue #2 "Night shift log".

## Turning it off

- Pause: disable the "Sprint supervisor" scheduled tasks. Running sessions finish their current task.
- Afterwards: one pull request deletes this file, `.claude/skills/sprint-*`, the sprint lines in the `implement-issue`
  and `night-shift` skills and the `reviewer` agent, and deletes the `lane:*` and `sprint-ready` labels.
