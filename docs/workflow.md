# Terminal Dusk — Claude Code Workflow

Exported from the Notion page "Terminal Dusk — Claude Code Workflow" on 2026-10-16.

## At a glance

You spend about an hour each evening deciding what to build; Claude builds it overnight on your PC; machines and Gemini check it before you look in the morning.

The daily loop has three parts:

- **Evening (you):** a design or spec session, then add `ready` to the issues to build.
- **Night (machines):** the night shift builds `ready` issues; CI and Gemini check each pull request.
- **Morning (you):** read the night-shift summary, answer held and blocked items, merge, and play the preview.

Only those three steps need you. Everything between them is automated and gated, and playtest feedback closes the loop into the next design session.

## Your setup and constraints

The workflow is built around one fact: you have about an hour a day of attention, but your PC can work all night. So your time goes into design decisions and judging results, and Claude spends the night turning approved specs into tested code.

| Constraint    | Your answer                                                                   | What it means for the workflow                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude plan   | Max 5x                                                                        | Usage limits, not money, are the bottleneck. Sonnet does most coding; Opus is saved for design, specs and review.                                                                             |
| Gemini        | Google AI Pro                                                                 | Gemini handles research, audits, mapping and browser testing on its own quota. Nothing may depend on it, because Google has cut Pro quotas several times this year.                           |
| Other project | Roguelike shares the plan for a few weeks                                     | Use those weeks for design and setup, which use little Claude. Full night shifts start once it's done.                                                                                        |
| Tool budget   | Up to ~$25/month                                                              | GitHub Pro (about $4) from week 1, for branch protection. From build phase 4, Supabase Pro ($25) and a paid email provider (Resend Pro is $20) take you past $25, so revisit the budget then. |
| Time          | Daily check-ins, ~1 hour most evenings, more on weekends                      | Morning: 10–15 minutes on your phone. Evening: one design or spec session. Weekend: playtests and weekly reviews.                                                                             |
| Autonomy      | Hands-on for design and rules; unattended implementation                      | You approve specs and judge behaviour. Code is checked by machines and a separate reviewer, not by you.                                                                                       |
| PC            | Can stay on overnight                                                         | Night shifts run locally on your PC, at no extra cost.                                                                                                                                        |
| Model split   | Gemini researches, audits, maps and tests; Claude writes all code and reviews | Gemini never edits source code. Its findings go to Claude, who checks them before acting.                                                                                                     |
| Code          | Private GitHub repo                                                           | Issues hold the task queue, pull requests hold the results, and the GitHub app is your morning dashboard.                                                                                     |
| Devices       | Android, iPhone, Mac (no Steam Deck)                                          | Every night's build is playable on all three. The Mac can likely build the iOS app itself, so no cloud Mac service is needed.                                                                 |
| Local LLM     | Dropped for this project                                                      | Its jobs (analysis, prompt drafting, hygiene checks) move to Gemini.                                                                                                                          |
| Game design   | Co-design                                                                     | You set direction, Claude drafts, you edit and approve.                                                                                                                                       |
| Design docs   | Notion or Google Drive                                                        | Notion (see Design workflow).                                                                                                                                                                 |
| Art and audio | AI-generated                                                                  | Placeholder art until the cards are stable, then a curated AI pipeline with a style guide.                                                                                                    |
| Playtesters   | A few friends                                                                 | A nightly web build they can open on any device, plus a short feedback form.                                                                                                                  |

## Roles

Each participant does the work it is cheapest and best at. Claude's models are split by how much judgement a job needs, because Opus uses your Max 5x limits faster than Sonnet.

| Who                                        | Does                                                                                                                                 | Never does                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **You**                                    | Game design decisions, approving specs, playing nightly builds, merging held pull requests, running playtests                        | Reading code line by line                                                       |
| **Claude Opus 5.5** (interactive)          | Co-design sessions, turning decisions into task specs, the reviewer subagent, hard engine work                                       | Routine implementation                                                          |
| **Claude Sonnet 5.5** (night shift)        | Implementing spec'd tasks with tests, fixing review findings, writing card data                                                      | Design decisions; changing a spec it disagrees with (it stops and asks instead) |
| **Claude Haiku 5.5** (helper)              | Searching the codebase (a project `Explore` agent), small doc chores                                                                 | Writing game code                                                               |
| **Gemini** (Antigravity app and `agy` CLI) | Research briefs, adversarial audits of specs and pull requests, weekly repo audits, browser testing of the nightly build, idea lists | Editing source code; merging anything                                           |
| **GitHub Actions**                         | Type checks, lint, boundary checks, tests, fuzzing, deploying the nightly preview                                                    | Anything that uses AI (keeps CI free of Claude usage)                           |

Two rules keep this honest. Gemini's findings are inputs: Claude verifies each one before changing code, and says which it rejected and why. And a different Claude session reviews every change than the one that wrote it, so the work is never only grading itself.

## Design workflow

Use **Notion** as the design workspace and the **repo** as the source of truth. Ideas, drafts and playtest feedback live in Notion, where you can edit them on your phone and share them with friends. A decision becomes real only when it is promoted into the repo, because that is the only place the agents read during implementation.

**Why Notion over Google Drive.** Card design is structured data: era, side, ops, status, effect, history note. Notion databases hold that directly, with filtered views ("Era 2, draft") and a built-in form for playtest feedback. Google Docs would mean a spreadsheet plus loose documents. Both Claude and Antigravity can read Notion through its connector. The free Notion plan is enough.

**Notion layout**

- **Design hub**: one page per topic — core loop, sides, eras, tension track, scoring, tutorial outline, art style guide.
- **Card concepts** database: one row per card, with status `idea → draft → approved → promoted`.
- **Playtest feedback** database, filled through a Notion form your friends use.
- **Open questions**: one row per unresolved decision, so nothing lives only in a chat.

**A co-design session (evening, about an hour)**

1. Pick one topic or a batch of 5–10 cards.
2. Work in the claude.ai Project with Opus. You set intent ("the Gulf War era should feel like a coalition scramble"); Claude drafts options with trade-offs; you choose and edit.
3. Claude writes the result into Notion: the topic page, or card rows set to `draft`.
4. When you're happy, set them to `approved`.
5. Gemini can prepare beforehand — historical event lists for an era, or a critique of a draft — so the session starts from material instead of a blank page.

**Promotion into the repo**

- A `promote` skill in Claude Code reads approved Notion items and writes them to the repo: rules to `docs/design/*.md`, cards to `content/` as data with their tests specified, and task issues for anything that needs engine work.
- It marks the Notion items `promoted` with a link to the commit.
- After promotion the repo wins any disagreement. To change a promoted card, edit it in Notion, set it back to `approved` and promote again; never hand-edit both.
- Night shifts never read Notion. This saves usage and means a half-finished idea can't leak into the code.

## Task pipeline

Every piece of work is a GitHub issue written as a spec, sized to finish in one fresh Claude session. A good spec is the biggest token saver in the whole workflow: an agent that is told which files matter and what "done" means doesn't spend usage exploring or guessing.

**The spec template** (a GitHub issue form)

- **Goal**: one or two sentences of behaviour, in game terms.
- **Read first**: the exact files and doc sections that matter, for example `docs/architecture.md#2` and `packages/engine/src/views.ts`.
- **Acceptance criteria**: testable statements ("playing a scoring card with 0 influence in the region awards 0 VP").
- **Out of scope**: what not to touch.
- **Size and model**: `size:S` or `size:M` (nothing larger; split it), and `model:opus` only for engine-core or tricky tasks.
- **Depends on**: other issue numbers.

**Labels move an issue through the pipeline**

| Label         | Meaning                                                          | Set by                       |
| ------------- | ---------------------------------------------------------------- | ---------------------------- |
| `needs-spec`  | An idea, not ready to build                                      | You or Claude                |
| `spec-review` | Spec written; waiting for Gemini's audit                         | Claude (`plan-tasks` skill)  |
| `ready`       | Approved for the night shift                                     | You                          |
| `in-progress` | Picked up tonight                                                | Night shift                  |
| `blocked`     | Gates failed or the spec was unclear; a report is attached       | Night shift                  |
| `held`        | Pull request waits for you (design question or reviewer concern) | Night shift                  |
| `auto-merge`  | Safe to merge when every gate is green                           | Claude, from the task's area |

**From decision to merged code**

1. In an evening session, the `plan-tasks` skill (Opus) breaks a promoted decision into issues, in dependency order.
2. An `agy` job asks Gemini to audit the new specs for gaps, contradictions with `docs/architecture.md`, and missing edge cases. It comments on each issue.
3. You skim the comments, ask Claude to fold in the valid ones, and add `ready`.
4. The night shift builds `ready` issues one at a time and opens a pull request for each.
5. CI and Gemini check each pull request. Green `auto-merge` pull requests merge themselves; anything else is labelled `held`.

**What auto-merges.** Anything the reviewer passed merges itself once CI is green, whether a night run or a day session opened it. Three kinds of change wait for you: the agents' own rules (`.claude/`, `CLAUDE.md`, `GEMINI.md`, `.github/`, `docs/architecture.md`, `tools/hooks/`, `tools/gates/`, `tools/git-hooks/`), database migrations and golden replays, and new dependencies or tool settings. So does anything the reviewer flagged (`held`). You judge them by their plain-English summary and the preview build, not the code. Engine rules, view filtering, the server write path and schemas no longer wait for you: tests, the fuzz run, golden replays and the reviewer guard them, and you were approving them from the summary anyway. GitHub enforces this: the agents work through a separate bot account, `.github/CODEOWNERS` lists you as owner of the paths that wait, and branch protection on `main` requires your approval for those and green `gate` and `tools-windows` checks for everything. Without that protection, auto-merge would merge a pull request before CI finished.

**Bugs** use a short bug form: what you did, what happened, what should have happened, and the match ID shown in the game. Because the engine is deterministic, Claude can rebuild the exact game from that ID and turn it into a permanent regression test.

## Unattended runs: the night shift

Each night a coordinator works through the `ready` queue one task at a time, handing each task to a fresh Claude subagent. Run it as a scheduled task in the Claude desktop app; a command-line script does the same job and is kept below as an alternative.

**Option A: a desktop scheduled task (recommended)**

Set it up once in the desktop app's Code tab, under Routines → New routine → Local.

| Setting         | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Schedule        | Daily, 11:00 pm                                                                                           |
| Folder          | The `terminal-dusk` repo                                                                                  |
| Permission mode | Auto                                                                                                      |
| Model           | Sonnet                                                                                                    |
| Worktree        | On                                                                                                        |
| Instructions    | "Run the `/night-shift` skill." The procedure itself lives in the repo, so it's versioned and reviewable. |

The `night-shift` skill makes that session a coordinator:

```text
first: hand each held pull request with new comments (yours or Gemini's) to the implementer subagent for one fix pass
then, for each issue labelled ready, in dependency order, up to the nightly cap (start at 4):
  1. label it in-progress
  2. hand it to the implementer subagent (own worktree, turn cap, Sonnet, or Opus if labelled)
  3. hand the result to the reviewer subagent; if it raises concerns, one more implementer pass
  4. gates green and review passed -> push, open a pull request (auto-merge if allowed)
     otherwise -> label blocked or held, attach the report
stop early if: the queue is empty, two tasks in a row fail, a usage-limit error appears, or it is after 3:30 am
finally: post one "Night shift" summary comment: done, held, blocked, usage notes
```

- **It stays efficient** because each subagent works in its own context and returns only a short summary, so the coordinator's context stays small all night.
- **Subagents run one at a time**, never in parallel. Parallel runs use your limits faster and can conflict.
- **The implementer agent file** (`.claude/agents/implementer.md`) sets `model`, `isolation: worktree`, `maxTurns` and the gate hook. A Stop hook in an agent's file runs when that subagent tries to hand back.
- **The task only fires while the desktop app is running and the PC is awake.** Turn on **Keep computer awake** (Settings → Desktop app → General) and leave the app open; minimised is fine.
- **Missed nights.** If the PC was asleep at 11:00 pm, the app starts one catch-up run when it wakes. The "stop between 3:30 am and 5 pm" rule keeps that from using your day's limits.
- **Where to look.** Runs appear under **Scheduled** in the sidebar, with a notification. A run that stalls on a permission prompt waits there for you.
- **First run.** Click **Run now** once while you're watching, and answer any prompt with "always allow" so later runs don't stall.

**Option B: a script and the CLI (alternative)**

The same procedure as plain code (`tools/night-shift.ts`), started by Windows Task Scheduler at about 11:00 pm or by `pnpm night` before bed. It enforces turn limits and the 3:30 am cutoff in code, spends no usage on the loop itself, and writes log files. The cost is that it runs in a terminal you'll rarely look at. Switch to it if the desktop coordinator proves unreliable.

```text
first: give each held pull request with new comments (yours or Gemini's) one fix pass
then, for each issue labelled ready, in dependency order, up to the nightly cap (start at 4):
  1. label it in-progress; create a git worktree on branch task/<issue>
  2. claude -p "/implement-issue <issue>" --model sonnet (or opus if labelled)
       --permission-mode auto --permission-prompts none --max-turns 150 --output-format json
  3. gates green and reviewer passed -> push, open a pull request (auto-merge if allowed)
     otherwise -> label blocked or held, attach the session's report
  4. remove the worktree
stop early if: the queue is empty, two tasks in a row fail, a usage-limit error appears, or it is 3:30 am
finally: post one "Night shift" summary comment: done, held, blocked, usage notes
```

CLI-only traps:

- Make sure no `ANTHROPIC_API_KEY` environment variable exists. If one does, `claude -p` silently bills the API instead of your Max plan.
- Don't use `--bare`, which needs an API key.
- Worktrees created by `claude -p` aren't removed automatically, so the script removes them.

**Inside each task** (the `implement-issue` skill, which the implementer follows in either option)

1. Read the issue and only the files it lists. Use the Haiku `Explore` agent if more searching is needed.
2. Write failing tests from the acceptance criteria first, then implement until they pass.
3. The gate hook runs the full local gate and won't let the work finish while anything is red (details in Quality gates).
4. A separate `reviewer` subagent (Opus, read-only, fresh context) compares the diff with the spec and the architecture rules, and returns pass or a list of concerns.
5. Fix the concerns once. Anything still open becomes `held`, with the concerns in the pull request.
6. If the spec is unclear or contradicts the architecture, stop, ask the question on the issue and mark it `blocked`. Never make a design decision at night.
7. Open the pull request with a fixed template: behaviour change in plain English, tests added, anything uncertain.

**Safety for unattended runs**

- **Auto mode** lets a classifier approve routine actions instead of you. In the desktop task you pick it in the task's permission picker. On the CLI, `--permission-prompts none` also refuses anything that would otherwise need a prompt. Claude Code's own docs say auto mode doesn't guarantee safety, so the deny rules below are the real fence.
- **Deny rules** in `.claude/settings.json` apply to both options: no `curl` or `wget`, no reading `.env` files, no `git push --force`, no pushing to `main`, no `git reset --hard`. Hooks add the rest. The implementer's file-lock hook blocks edits to Locked paths (`.claude/`, `.github/`, `docs/architecture.md` and the others in `tools/hooks/shared.mjs`), and bash-guard blocks disguised versions of the shell rules and the owner-only `gh` commands. No web pages at night, because they are the main route for prompt injection: the night-shift skill's `no-web` hook blocks the coordinator, and the implementer and reviewer can't use the web at all. Golden replays and the other code-owned paths still wait for your approval on GitHub. An agent can't loosen its own rules or skip a test.
- **Library docs** come through the Context7 connector, which is read-only, instead of the open web.
- **Worktrees and branches** keep every task isolated and reversible; nothing reaches `main` except through CI.
- **Native Windows has no command sandbox** (Claude Code's sandbox runs on macOS, Linux and WSL2). That's acceptable with the fences above. If you later want a hard sandbox, run night shifts in WSL2: the desktop app can run sessions there (without plugins), and the CLI script runs unchanged.

**Windows settings to fix once**

- Keep the PC from sleeping: **Keep computer awake** in the desktop app, plus a power plan that never sleeps.
- Set Windows Update active hours to cover the night. A reboot kills running sessions.
- Install Git for Windows; Claude Code uses its Bash for hooks and scripts.

## Daytime sessions

Day sessions follow the same pipeline as the night shift, so you only step in for the decisions that are yours.

- **Few prompts.** Routine work runs without asking: tests, the gate, git, pull requests, web searches and web pages, and read-only `gh api` and `gh repo view` calls. You still get a prompt for edits to Locked files, `gh auth`, `gh secret`, and any `gh api` or `gh repo` call that could change GitHub (bash-guard decides which those are).
- **Pull requests finish themselves.** After opening one, the session runs the reviewer agent and fixes its concerns once. On a pass it turns on auto-merge, and GitHub merges when CI is green. Code-owned changes wait for your approval on GitHub; anything the reviewer still doubts is labelled `held` with the concerns in a comment.
- **One worktree per parallel session.** Two sessions in the same folder test each other's half-finished work, and the Stop hook's gate fails for both. When you run more than one at a time, start each in its own worktree: the **worktree** option when you start a session in the desktop app, or `claude --worktree <name>` on the CLI. A single session can stay in the main folder.

**From your phone.** In the desktop app, turn on **Connect new sessions to Remote Control**. Your sessions then appear in the Claude mobile app, where you can steer them, and Dispatch (included with Max) starts new ones from your phone. CLI alternative: `claude remote-control --spawn worktree` gives each phone-started session its own worktree.

## Token and usage efficiency on Max 5x

Max 5x has a 5-hour session limit and a weekly limit, shared across claude.ai, Claude Code and the desktop app. Anthropic doesn't publish exact numbers, so calibrate in week one: run one night shift, then check the usage ring next to the desktop app's model picker. On the CLI, `/usage` also breaks usage down by skill, subagent and connector. The biggest savings come from short, focused sessions; model choice is second.

**Habits that save the most**

1. **One task, one fresh session.** Context grows with every turn, and each turn re-sends it. The night shift already starts fresh per task; do the same by day with `/clear` between unrelated jobs.
2. **Specs that name files.** "Read first" lists stop agents from exploring the whole repo.
3. **Size tasks to fit one context.** If a task needs `/compact`, it was too big. Compacting is itself a large request.
4. **Don't resume old sessions after a gap.** The subscription prompt cache lasts about an hour; after that, resuming re-sends everything at full cost. Write a short handoff note and start fresh instead: `/handoff` writes it, then `/clear` and `/handoff resume` pick it up. Claude writes one by itself once a conversation passes 60% of the auto-compact window, and a new or cleared session tells you when a note is waiting.
5. **Quiet tools.** Hooks and test scripts print only failures, trimmed. A passing test run should cost one line, not a screen.

**Model and effort defaults**

| Work                                  | Model      | Effort                                      |
| ------------------------------------- | ---------- | ------------------------------------------- |
| Co-design and spec writing (evenings) | Opus 5.5   | medium; high for hard rules questions       |
| Night-shift implementation            | Sonnet 5.5 | medium                                      |
| Engine-core tasks (`model:opus`)      | Opus 5.5   | medium                                      |
| Reviewer subagent                     | Opus 5.5   | medium; it reads only the diff and the spec |
| Codebase search (`Explore` override)  | Haiku 5.5  | low                                         |

Claude Code's built-in `Explore` agent uses your main model. Defining a project agent also named `Explore` with `model: haiku` makes every search cheap.

**Keep context lean**

- `CLAUDE.md` stays under 200 lines. Details live in `docs/architecture.md` and in path-scoped rule files under `.claude/rules/`, which load only when Claude touches matching files.
- Turn off connectors in coding sessions (`/mcp`). Use the `gh` command line for GitHub instead of a connector.
- Install the TypeScript language-server plugin: Claude sees type errors right after each edit instead of running a full type check to find them.
- A script regenerates `docs/repo-map.md` (packages, files and their exports) on every commit, at no token cost. Agents read it instead of listing folders.

**Send bulk reading to Gemini.** Whole-repo audits, research and long documents use Gemini's quota, not yours. Claude reads Gemini's short report, not the material behind it.

**Budget the week.** While the roguelike is still running, give Terminal Dusk two or three night shifts a week, and pause the scheduled task on the other nights. Afterwards, run it every night. If plan usage shows the weekly bar running ahead, lower the nightly cap before you lower anything else.

## Gemini's lane

Gemini works through Antigravity: the desktop app for interactive work and browser testing, and the `agy` command-line tool for scheduled jobs. Gemini CLI was replaced by the Antigravity CLI for Google AI Pro users on June 18, 2026, so plan around `agy`. It reads the repo and writes reports and GitHub comments; it never edits source code.

| Job                | When                              | How                                                                                                    | Output                                                                           |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Spec audit         | Evenings, after `plan-tasks`      | `agy -p` with a saved audit prompt; plan-tasks runs it at the end                                      | A comment on each new issue: gaps, contradictions, missing edge cases            |
| Pull request audit | 4:30 am, after the night shift    | A 4:30 am scheduled task runs `agy -p` on each new pull request's diff                                 | A pull request comment marked blocker or note                                    |
| Repo audit         | Weekly                            | `agy -p` over the whole repo against `docs/architecture.md`                                            | A comment on the pinned "Gemini weekly audit" issue: drift, dead code, test gaps |
| Browser test       | Weekly, and before every playtest | Antigravity app's browser agent plays the nightly build from a test script, at phone and desktop sizes | Screenshots and bug issues                                                       |
| Research briefs    | On request                        | Antigravity app                                                                                        | `docs/research/<topic>.md` with sources                                          |
| Design prep        | Before a design session           | Antigravity app                                                                                        | Event lists, critiques or idea lists for Notion                                  |
| Repo narrative     | Monthly                           | `agy -p`                                                                                               | A plain-English "how the code is organised" page for you                         |

**Scheduling the audits.** The 4:30 am and weekly audits are small desktop scheduled tasks whose only step is running `tools/gemini-audit.ts`. Use Haiku in Manual mode with that one command set to "always allow" (Auto mode doesn't support Haiku), so each run costs almost no Claude usage. Windows Task Scheduler can run the same script with no Claude usage at all.

**Settings.** Gemini gets read access and nothing else. The `tools/gemini-audit.mjs` script hands it the material, runs `agy -p`, and posts the findings to GitHub itself, so Gemini never needs GitHub access. Never use `--dangerously-skip-permissions`; in headless runs, anything not pre-approved is quietly refused.

**How Claude uses the findings.** The night shift's `implement-issue` skill reads any Gemini comment on its issue or pull request, checks each point against the code and the spec, applies the valid ones, and replies with what it rejected and why. A Gemini "blocker" on a pull request keeps it `held` until Claude has answered it.

**Expect Gemini to be unavailable sometimes.** Google cut AI Pro quotas four times between December 2025 and March 2026, with week-long lockouts reported. Every Gemini job is optional: if it fails, the pipeline continues and the morning report says the audit was skipped.

## Quality gates

Five layers check every change, cheapest first, so most problems are caught before they cost review time. You are the last layer, and you judge behaviour, not code.

| Layer                | When                                  | Checks                                                                                                                                                                                               | Cost                          |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1. Editor feedback   | After every edit                      | TypeScript language server shows type errors immediately                                                                                                                                             | Free                          |
| 2. Session hooks     | During the session                    | After edits: lint and type check of the changed package. Before finishing: the full local gate (type check, lint, boundary check, unit tests, per-card tests, a 1,000-game fuzz run, golden replays) | Local CPU only                |
| 3. Reviewer subagent | End of each task                      | Diff against the spec's acceptance criteria and the architecture rules                                                                                                                               | Opus usage, kept small        |
| 4. GitHub Actions    | Every pull request; nightly on `main` | Everything above, plus a 10,000-game fuzz, Playwright at phone and desktop sizes (Chromium and WebKit, which stands in for iPhone Safari), then a preview deploy                                     | Free minutes                  |
| 5. Gemini and you    | Morning                               | Gemini audits the diff; you play the preview and read held pull requests                                                                                                                             | Gemini quota; your 15 minutes |

**How the Stop hook works.** When Claude tries to finish, the hook runs the full local gate. If anything fails, it returns the trimmed failure output and Claude must keep working. Claude Code lets a session through after eight blocks in a row, so a truly stuck task still ends, and the night-shift coordinator then marks it `blocked`.

**Tests can't be weakened quietly.** A CI check fails if the number of tests drops or any test is marked skip, unless the pull request is labelled `held` with a reason. Golden replays change only when a rules change is intended, and those pull requests always wait for you.

**CI minutes.** A private repo on GitHub Free gets 2,000 Linux minutes a month, which comfortably covers this. If you outgrow it, register your always-on PC as a self-hosted runner, which is currently free; GitHub postponed a planned fee indefinitely.

**Nightly preview.** CI deploys `main` to a private preview address on Cloudflare (free plan) after the morning merges, showing the build number and ruleset in a corner. That build is what you, Gemini's browser tests and your friends play.

## Device testing and playtesting

The nightly preview build is the shared test bed for you, Gemini and your friends. Automated tests cover rules and layout; people cover feel, clarity and fun.

**Your devices**

- **Android and iPhone**: open the preview in the browser each morning when a pull request changed something visible. iPhone Safari is the strictest browser you'll ship on, so treat it as the reference.
- **Mac**: desktop browser testing now. Later it can build the iOS app with Xcode, which removes the cloud Mac service the architecture doc planned. Check that your Mac can run the latest Xcode before build phase 8; if it can't, fall back to a cloud build service.
- No Steam Deck: use Steam Playtest with a friend who has one, and Linux checks in CI, when the Steam phase comes.

**Playtesting with friends**

- **Start in build phase 3**, when a 25-card game against the AI runs on phones. Online games between friends come in phase 4.
- **Feedback goes through the Notion form.** It asks for the match ID (shown in the game menu), the device, what was confusing, and what was fun. The form never asks for code-level detail.
- **Weekly triage** (weekend, about 30 minutes): you and Claude (Opus, in the claude.ai Project with Notion connected) sort the week's feedback into design questions for Notion and bug issues for the queue.
- **Every bug report with a match ID becomes a regression test.** Claude rebuilds the game from its move log and keeps it as a golden replay, so the same bug can't return unnoticed.
- **Scripted sessions before big changes.** For a new era or a rules change, give friends one specific goal ("try to win as LIO using only ops"). Focused tests find more than open play.

**Balance data.** Once AI-vs-AI games and online games run, results by side are recorded automatically. Review them monthly in a design session; balance changes then go through the normal design and promotion steps.

## Art and audio pipeline

Use placeholders until the cards stop changing, then produce AI art and audio through one repeatable pipeline with a written style guide. Generating final art early wastes effort on cards that will be cut or reworded.

**Until build phase 5: placeholders.** Claude builds clean card frames, icons and map styling in SVG and CSS. They cost nothing, stay readable on phones, and are swapped out by changing the asset manifest, not the code.

**Style guide first.** One Notion page, decided in a design session: palette, card frame, illustration style, how the map looks, and what each side's visual identity is. Pick a stylised, flat or illustrated look that stays readable at phone size. Two hard rules:

- **No likenesses of real people.** Illustrate events through places, objects, symbols, documents and crowds without identifiable faces. This keeps you clear of the store and likeness risks in the architecture review, and image tools often refuse real people anyway.
- **No imitation of the original game's look**, its card frames or its map.

**Images**

1. **Choose the tool with a bake-off.** When you write the style guide, generate the same 5 cards in Gemini (Nano Banana, included in Google AI Pro) and in one alternative, such as ChatGPT's image model or Midjourney. Judge how well each tool keeps the set consistent, not which made the single best image. Switching tools after 50 cards breaks the look of the set, so treat this choice as permanent.
2. A Claude skill (`art-prompts`) writes one prompt per card from its data, its historical note and the style guide, in batches.
3. You generate each image, giving the tool 3–5 approved style-guide cards as reference images (Nano Banana 2.1 accepts up to 14). Pick the best variant and drop it into `assets/inbox/`. Picking is the one step worth keeping human.
4. A script resizes and converts images for phone and desktop, and records each one in `assets/manifest.json`: tool, prompt, date, and that you approved it.

**Rules for every illustration**

- **No text in the art.** The game draws card names and rules in HTML. Text baked into an image can't be edited or corrected, and it blurs on phones.
- **One colour treatment, applied in code.** A duotone or limited-palette filter over every illustration makes images from slightly different generations look like one set, and makes the files smaller.
- **Illustrations and key art only.** The map, icons and card frames stay as SVG built in code, so they stay sharp and easy to change.
- **Turn off Gemini's visible watermark** in its settings (offered since August 2026, except where local law requires a visible mark). The invisible SynthID watermark always remains; it's harmless and fits the Steam disclosure.

**Music.** Lyria 3 Pro in the Gemini app makes tracks up to three minutes for paid subscribers, and every output carries Google's SynthID watermark. Google's terms for commercial use of those tracks in a paid game weren't confirmed; check them before you ship any. Plan on a handful of tracks: menu, one per era, and victory and defeat stings.

**Sound effects.** Use CC0 libraries (no attribution, commercial use allowed), checking each file's licence and recording it in the manifest. An AI sound-effect tool can fill gaps later within your budget.

**Disclosure.** Steam's AI disclosure, updated in January 2026, covers AI-generated content players see or hear — art, audio, text — but not AI coding tools. The manifest makes that disclosure, and the matching notes for other stores, a five-minute job.

**One caveat.** Purely AI-generated images generally can't be copyrighted in the US, so others could reuse your card art. Consider having your logo and key store art touched up or made by a person.

## Repo setup

The workflow lives in the repo, so every session — interactive, overnight or from your phone — follows the same rules without being told. Claude can build all of this in the first evening and night of build phase 1.

```text
CLAUDE.md                     the agent rules (under 70 lines)
GEMINI.md                     Gemini's read-only role
.claude/
  settings.json               permissions, default model, hook wiring
  rules/                      engine, content, server, app and test rules, loaded by path
  agents/
    Explore.md                Haiku, read-only: replaces the built-in search agent
    implementer.md            Sonnet, own worktree, turn cap, gate and file-lock hooks
    reviewer.md               Opus, read-only: diff vs spec and architecture
  skills/
    night-shift/  implement-issue/  plan-tasks/  promote/
    card/  triage/  art-prompts/  handoff/
docs/
  architecture.md             the core decisions doc, exported as Markdown
  workflow.md                 this doc, exported as Markdown
  design/                     promoted game rules, one file per topic
  repo-map.md                 generated on every commit
  research/                   Gemini briefs
tools/
  hooks/                      env-check, bash-guard, quick-check, gate, file-lock
  gates/                      what `pnpm gate` runs
  gemini/prompts/             spec, pull request, weekly and narrative audit prompts
  gemini-audit.mjs            runs agy and posts its findings to GitHub
  repomap.ts                  regenerates docs/repo-map.md
  night-shift.ts              the CLI alternative to the scheduled task (option B)
.github/
  CODEOWNERS                  you own every Locked and Held path
  ISSUE_TEMPLATE/             task and bug forms
  pull_request_template.md
  workflows/                  ci.yml, nightly.yml, preview.yml
```

Full drafts of every one of these files, with the reasoning, are in the Claude Code configuration doc (Notion).

The desktop app keeps scheduled tasks outside the repo, in `~/.claude/scheduled-tasks/`. Their instructions only call the repo's skills, so the procedures themselves stay versioned.

**Settings worth calling out**

- Default model `sonnet`. Switch to Opus with the model picker (or `/model` on the CLI) for design and spec sessions.
- `permissions.deny` holds the night-shift fences listed above. Deny rules win even over auto mode, in the desktop app and the CLI alike.
- Hooks: an after-edit hook for fast checks, and the full gate as a Stop hook, both in project settings and in the implementer's agent file. All of them print failures only.
- `.claude/settings.local.json` (not committed) holds anything specific to your PC.

**One-time setup**: on your PC, Git for Windows, Node and pnpm, the GitHub CLI (`gh`) and the `agy` CLI; Claude can run most of these installs for you inside a desktop session. In the desktop app, add the TypeScript language-server plugin (**+ > Plugins**) and the Context7 connector. On GitHub, upgrade to Pro, create a bot machine account for the agents, and sign Git and `gh` on your PC in as the bot. The Claude Code CLI is only needed for option B, and you already have it.

## Daily and weekly rhythm

Your attention goes to three short slots a day; machines fill the rest. Times are suggestions in Eastern time.

| When                        | Who                   | What                                                                                                                                                         | Your time |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 11:00 pm–3:30 am            | Night shift           | Held pull requests first, then `ready` issues, one at a time                                                                                                 | None      |
| 4 am                        | Nightly CI            | Full gate and 10,000-game fuzz on `main` (08:00 UTC; an hour earlier in winter)                                                                              | None      |
| 4:30 am                     | Gemini                | Audits each new pull request                                                                                                                                 | None      |
| 6:00–6:30 am, on your phone | You                   | Read the "Night shift" summary in the GitHub app. Answer questions on `held` and `blocked` items in plain words. Merge held pull requests you're happy with. | 10–15 min |
| After the morning merges    | CI                    | Deploys the nightly preview                                                                                                                                  | None      |
| Daytime, optional           | You                   | Play the preview for five minutes if something visible changed; file a bug from your phone if needed                                                         | 0–10 min  |
| Evening                     | You and Claude (Opus) | One of: a design session, a spec session (`plan-tasks`), or a fix session through Remote Control                                                             | ~1 hour   |
| Evening, after specs        | Gemini                | Audits new specs                                                                                                                                             | None      |
| Before bed                  | You                   | Skim spec audits, ask Claude to fold in the valid points, add `ready` to 2–6 issues                                                                          | 5–10 min  |

**Weekly (weekend)**

- Playtest with friends, then a 30-minute triage of the feedback.
- Read Gemini's weekly repo audit; queue fixes for anything real.
- Gemini's browser test of the preview.
- Check plan usage (the usage ring in the desktop app) and adjust the nightly cap.
- A longer design session for the next era or system.

**Monthly**

- Review balance data and Gemini's "how the code is organised" page.
- Update dependencies in one dedicated night-shift task, never mixed with feature work.

**Keep the queue fed.** The night shift is only as useful as the `ready` queue. Aim to finish each week with at least five nights of specs approved, so a busy week doesn't leave the PC idle.

## First two weeks

While the roguelike is still using your Claude limits, spend these weeks on setup and design, which need little Claude usage. The first real night shift runs at the end of week two.

**Week 1: set up (mostly no code)**

- [x] Install Git for Windows, Node, pnpm and the GitHub CLI (Claude can run most of this in a desktop session)
- [x] Upgrade your GitHub account to Pro, and create the bot machine account (for example `terminal-dusk-bot`)
- [x] Create the private repo `terminal-dusk`, and give the bot write access, not admin
- [x] Sign Git and `gh` on your PC in as the bot
- [x] Export the architecture doc as Markdown into `docs/architecture.md`, and this doc into `docs/workflow.md`
- [x] Install the Antigravity CLI (`agy`), sign in once interactively, and give it read-only permissions
- [x] In the desktop app: add the TypeScript language-server plugin and the Context7 connector, and turn on **Keep computer awake** and **Connect new sessions to Remote Control**
- [x] Set Windows Update active hours to cover the night
- [x] Set up Notion: Design hub, Card concepts database, Playtest feedback database and form, Open questions
- [x] One evening: ask Claude to scaffold build phase 1 from the architecture doc and the configuration doc (workspaces, CI, the `.claude/` folder, hooks, issue forms, CODEOWNERS)
- [x] Protect `main` on GitHub: pull requests only, the `gate` and `tools-windows` checks, code-owner review, no force pushes, and allow auto-merge
- [x] Run the setup tests in the configuration doc
- [x] Create the night-shift scheduled task (Routines → New routine → Local) and pause it until week 2
- [x] Only if you use the CLI route: check that no `ANTHROPIC_API_KEY` environment variable exists

**Week 2: design and the first night shift**

- [x] Design sessions: core loop and what changes from the original, the two sides, era list
- [x] Make the product calls listed in the architecture doc
- [ ] Pick the 25 cards for the first slice, at least one per mechanic type
- [ ] Draft the art style guide (placeholders come first, so this can wait)
- [x] Promote the first decisions, and have `plan-tasks` write the engine-skeleton specs
- [ ] Run Gemini's spec audit, then mark the first 3–4 issues `ready`
- [ ] Turn the night-shift task on, click **Run now** while you can watch the start, and answer any prompt with "always allow"
- [ ] Next morning, check plan usage and tune the nightly cap and the model split

**When the roguelike ends:** move to a night shift every night and a full `ready` queue each week.

## Sources

Not verified: exact Max 5x usage numbers and the Opus-to-Sonnet usage ratio (not published), and Google's commercial-use terms for Lyria music.

**Claude Code (official docs)**

- [Use Claude Code Desktop](https://code.claude.com/docs/en/desktop.md) and [desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks.md)
- [Headless mode](https://code.claude.com/docs/en/headless.md) and [CLI reference](https://code.claude.com/docs/en/cli-reference.md)
- [Permission modes](https://code.claude.com/docs/en/permission-modes.md), [permissions](https://code.claude.com/docs/en/permissions.md) and [sandboxing](https://code.claude.com/docs/en/sandboxing.md)
- [Hooks guide](https://code.claude.com/docs/en/hooks-guide.md)
- [Subagents](https://code.claude.com/docs/en/sub-agents.md) and [skills](https://code.claude.com/docs/en/skills.md)
- [Worktrees](https://code.claude.com/docs/en/worktrees.md) and [Remote Control](https://code.claude.com/docs/en/remote-control.md)
- [Memory and CLAUDE.md](https://code.claude.com/docs/en/memory.md), [costs](https://code.claude.com/docs/en/costs.md) and [model configuration](https://code.claude.com/docs/en/model-config.md)
- [Authentication](https://code.claude.com/docs/en/authentication.md) and [setup](https://code.claude.com/docs/en/setup.md)
- [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence.md)
- [Using Claude Code with a Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)

**Gemini and Antigravity**

- [Antigravity CLI headless mode](https://antigravity.google/docs/cli/headless/)
- [Gemini CLI quotas page, noting its replacement by the Antigravity CLI](https://geminicli.com/docs/resources/quota-and-pricing/)
- [Antigravity 2.0 review: browser subagent and quota cuts](https://dev.to/jovan_chan_9500711396d4e6/google-antigravity-20-review-2026-browser-subagent-20month-pro-and-the-quota-problem-6ob)
- [Lyria 3 Pro availability](https://futurefive.com.au/story/google-expands-lyria-3-pro-music-tool-across-products)

**Other**

- [GitHub Actions pricing changes in 2026](https://cicdcost.com/github-actions-pricing-changes-2026)
- [About protected branches](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [GitHub's terms on machine accounts](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [Steam's updated AI disclosure form](https://www.notebookcheck.net/Steam-updates-AI-disclosure-form-requiring-developers-to-report-visible-and-in-game-AI-but-not-background-tools.1206103.0.html)
- [Artificial Analysis text-to-image leaderboard](https://artificialanalysis.ai/image/leaderboard/text-to-image)
- [Nano Banana 2.1 launch](https://www.androidauthority.com/google-launches-nano-banana-2-1-3719823/)
- [Gemini's visible watermark can now be turned off](https://www.gizchina.com/gemini/google-finally-lets-you-remove-geminis-visible-ai-watermark)
