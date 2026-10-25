Proposal, not a rule

# How "the AI plays the missed turn" could work online: options

Sprint backlog X8. The product call on missed deadlines (docs/architecture.md, "Product calls") lets whoever
sets up a private game pick one of three rules: loss on time; one grace extension, then loss on time; or "the AI
plays the missed turn". Ranked games always use loss on time. The same row says the third rule is still open,
because Decision 8 rules out an AI on the server. This file lays out options for that third rule, with their
trade-offs. It decides nothing, changes no code, and does not change docs/architecture.md.

## What exists today (read from the code)

- **Two deadline rules, not three.** `packages/host/src/types.ts` has `DeadlineRule = "lossOnTime" |
"graceThenLoss"` and `MatchDeadline = { rule, days: 1 | 3 | 7 }`. The match clock adds, per side, a deadline
  (or null when the game is not waiting on that side) and whether its grace extension is used. There is no third
  rule, no AI setting, and no field that says a side's moves were made by the AI. **No "AI plays the missed turn"
  rule exists yet.**
- **When a side's clock starts.** `startClock` (`clock.ts`) gives every side with a pending Decision one deadline
  length from the start. After each accepted move, `nextClock` gives a side a **fresh full deadline whenever its
  pending Decision changes** (a new Decision id), keeps the deadline when the same Decision still waits, and sets
  it to null when nothing waits.
- **What the host does at a deadline.** `hostDeadline` (`hostDeadline.ts`) looks at every side whose deadline is
  at or before `now`. A late side with its grace extension left gets one more full length from `now` (seq, state
  and move log unchanged). A late side without one loses on time through `hostTimeout`. When both sides are late
  and neither has an extension left (always so under `lossOnTime`), the game ends in a draw on time (a timeout for
  `"both"`).
- **A late answer from a player.** `hostSubmit` refuses an answer at or after the side's deadline with
  `pastDeadline` when that side has no grace left. With grace left it takes the answer and uses up the extension.
- **The deadline sweep.** `sweepDeadlines` (`packages/server/src/sweepDeadlines.ts`) runs every minute (O11). For
  each match the store says is due, it loads the match, calls `hostDeadline`, and saves the result with the same
  `where seq = expectedSeq` check `submit` uses: `saveClock` for an extension, `commit` for a loss on time. It
  reports `extended`, `timedOut`, `conflict` or `skipped`. It never asks the late side for anything.
- **The AI.** `packages/ai` exports Easy only (`easyAnswer`, `createEasyPlayer`, a worker handler). It takes a
  `PlayerView` for one side and returns an answer value (or null). It never sees `GameState`. Medium, Hard and
  Expert are not built yet. The import table in docs/architecture.md ("Guardrails") lets `app` use `ai`, but not
  `server` or `host`.
- **The move log.** Each accepted answer is stored in the match's secret move log as an ordinary engine `Answer`
  (`{ decisionId, side, value }`, or a system action such as a timeout). Replay verification re-applies that log
  from the seed. Nothing in the log says who or what chose an answer.

## Facts every option has to deal with

1. **Both sides late at once.** A simultaneous pick gives both sides the same deadline (`startClock`), so the
   sweep can find both late at the same `now`. Both players can also simply be offline.
2. **A card play spans several Decisions.** One card play can ask the same side several things in a row (how to
   play the card, then choices inside its effect), and can pause mid-card for the _other_ side and come back.
   Because `nextClock` restarts the clock on every new Decision, an option that answers only "the one missed
   Decision" hands the absent player a fresh 1, 3 or 7 days on the very next Decision of the same card.
3. **Telling an AI answer from a late human answer.** `hostSubmit` must keep refusing a late human answer
   (`pastDeadline`), yet accept the AI's answer after the same deadline. And the answer must be recorded so that
   replay verification (docs/architecture.md, "Guardrails", fuzz invariant 6) still holds.

On fact 3, every option below can reuse one idea: the AI's answer goes into the move log as an **ordinary
answer** (`{ decisionId, side, value }`), so replay re-applies it exactly like a human's and verification is
unchanged. The fact that the AI chose it is recorded **beside** the log, not inside the engine `Answer` (for
example a list of the log positions that were autoplayed, or a flag on the clock). That keeps the engine
untouched (a new system `Answer` that makes the engine choose the move would put AI choices inside the rules
engine, while Decision 8 keeps the AI a separate player). Where the marker lives (the public `match` record, so both players can see "the AI played this", or
only the secret) is a choice listed under "Questions for the owner".

Three options follow. Option A keeps Decision 8 unchanged. Option C keeps Decision 8 unchanged by not using the
AI at all. Option B changes Decision 8. A fourth idea, the rival's device, is ruled out at the end.

---

## Option A: the late player's own device plays the turn with the AI

**In one sentence.** When a side misses its deadline, the server marks that side "AI due", and the late
player's own app runs Easy AI on that player's own frame and submits the answer the next time the app is open
(or, where the platform allows it, in the background after a push).

- **Who runs the AI, on what device.** The late player's own device (web, Steam, phone), in the same Web Worker
  the app already uses for games against the AI. No AI runs on the server.
- **What view the AI receives, and how that is proven.** The frame the server already sends that player for
  their own side: `match_view` for that side, which holds `viewFor(state, side)`. The device receives nothing it
  does not already receive today, so no secret, seed or rival private field reaches any client. Proof: a unit
  test in `app` that the autoplay path passes the AI exactly `frame.view` from the transport (the same call the
  local AI game makes); the existing read-rule and leak tests (`read.leaks.test.ts`, `submitHandler.leaks.test.ts`)
  still cover what the device can read; and the boundary check keeps `ai` from importing anything but `engine`
  and `content`.
- **How the answer reaches the game.** Through `submit`, as a normal answer with one extra field, for example
  `autoplay: true`. The host accepts an `autoplay` answer after the deadline only when the match's rule is the
  AI rule and the sweep has marked that side "AI due"; it still refuses an ordinary late answer with
  `pastDeadline`. The host records the log position as autoplayed (see "Facts", point 3).
- **How the server tells it apart from the player's own answer.** It **cannot** check it. The answer comes from
  the player's own device, and the server has no way to know whether the AI or the player chose it. The
  `autoplay` flag is the device's word. This is the main weakness of this option (see trade-offs).
- **If that device is offline.** Nothing happens until the player returns: the game waits, and the rival waits
  with it. A push may wake a phone app, but iOS and Android do not promise background time, and the web and
  Steam builds cannot run when closed. Without a cap the deadline stops meaning anything, so this option needs a
  fallback: after some further time "AI due" (for example one more deadline length) the side loses on time as
  today. That cap is a game-design choice (question 4).
- **Which AI tier.** Easy is the only tier built. Later the device could use whatever tier the player has, or a
  tier the game's creator picked in the lobby (question 5).
- **How many missed Decisions.** Any of the three spans works here, because the device simply keeps answering
  while the side is "AI due": one Decision, the rest of the turn, or every Decision until the player makes a move
  of their own (which clears the mark).
- **What the player is told.** On opening the app: "Your deadline passed. The AI played for you: ..." with the
  moves it made, then the game as normal. The rival sees in their frame that the AI played that turn (if the
  marker is public). A host-level notice on the frame avoids a new engine EventKind; if a new EventKind were
  used instead, hard rule 9 needs its presentation entry.

**The three cases.**

- _Both sides late at once._ Each side is marked "AI due" independently. Each device plays its own side when it
  next opens. A simultaneous pick completes only when both have answered, so if both players stay away the game
  waits until the cap, then ends as it does today (a draw on time for a missed simultaneous pick, or a loss).
- _A card play over several Decisions._ While the side is "AI due", the host gives that side's new Decisions an
  immediate deadline instead of a fresh full length, so the device answers them in the same session. If the card
  pauses for the rival, the rival gets their normal full deadline; when it comes back to the late side, the AI
  answers again at once. This needs a change to `nextClock` (do not restart the clock for an "AI due" side).
- _Accepted after the deadline, recorded for replay._ The host accepts only an `autoplay` answer for an "AI due"
  side; a plain late answer still gets `pastDeadline`. The log entry is an ordinary answer, so replay
  verification holds; the autoplay marker sits beside it.

**Trade-offs.**

- _Fairness and cheating._ Weakest of the three. A player who misses a deadline can choose the "AI" answer by
  hand (a modified client can send any answer with `autoplay: true`), so missing a deadline costs them nothing
  and gains them time. The rival has no way to check. Easy's answer is repeatable for a given view and noise
  seed, so the server _could_ re-check it, but only by running the AI itself, which is Option B.
- _Running cost._ None on the server beyond today's sweep.
- _Reliability._ Poor when the player stays away, which is exactly when the rule is needed. The game stalls until
  they return or the cap ends it.
- _Work by package._ **host**: a third deadline rule, an "AI due" mark on the clock, the `autoplay` submission
  and its checks, `nextClock` not restarting an "AI due" side, the autoplay marker. **server**: the sweep marks
  "AI due" instead of timing out, applies the cap, and sends the push; `submit` passes the flag through.
  **app**: detect "AI due" on its own frame, run the worker, submit, show the notice; a lobby choice for the
  rule (A8). **ai**: nothing new.
- _Migration or architecture change._ Decision 8 unchanged. The clock is stored in the `match.clock` jsonb column,
  so new clock fields may not need a migration; any SQL that checks the deadline rule (lobby, invite) would. A
  public autoplay marker outside the clock would be a migration. docs/architecture.md would only need its "open
  point" in the deadline row updated (owner's change).

---

## Option B: the server runs the AI, as an explicit change to Decision 8

**In one sentence.** The deadline sweep, finding a late side under the AI rule, asks the host for that side's
view, runs Easy AI on it on the server, and submits the answer through the host like any move.

- **Who runs the AI, on what device.** The server, inside the deadline sweep's Edge Function (or a small
  "autoplay" function the sweep calls). No client is involved.
- **What view the AI receives, and how that is proven.** Only `viewFor(state, lateSide)`, the same view that
  side's player would get (the host already builds it in `framesFor`). The AI never gets `GameState`, the seed,
  the secret compartment or the rival's private compartment. Proof: the AI's input type is `PlayerView` (type
  check); a host-level function, for example `hostAutoplayView(record, secret, side)`, is the only place the view
  is built, and a test checks that its output equals `frames[side].view` and serialises with no seed, no deck
  card and no rival hand card (the same scan fuzz invariant 4 does); the boundary check gains a rule that only
  that one server file imports `ai`. Nothing new goes to any client: the clients only see the frames after the
  move, exactly as after a human move.
- **How the answer reaches the game.** Through the same host-and-commit path as `submit`: a host call such as
  `hostAutoplay(ruleset, record, secret, side, value, now)` that applies the answer and returns the usual
  `HostResult`, saved with `where seq = expectedSeq`, exactly like today's sweep saves a loss on time. Whether a
  scheduled job writing through that path counts as "`submit` only" under hard rule 7 is the same question
  today's sweep already raises (question 7).
- **How the server tells it apart from the player's own answer.** It made it itself, so it knows: only the sweep
  can call the autoplay host function, never a player request, and it records the log position as autoplayed.
  A player's late answer still goes through `hostSubmit` and still gets `pastDeadline`.
- **If that device is offline.** Not an issue: no player device is needed. If the Edge Function fails, the sweep
  tries again a minute later (it is safe to run twice: the seq check stops a double move).
- **Which AI tier.** Easy (under 200 ms, so cheap on an Edge Function). Hard or Expert (1 to 5 s each answer) would
  cost real server time and may hit Edge Function CPU limits.
- **How many missed Decisions.** Any of the three spans, decided by how long the side stays marked "AI plays".
  The sweep can answer every pending Decision for that side in one run, one host call each.
- **What the player is told.** A turn alert ("Your deadline passed and the AI played for you"), and in the game a
  notice listing what the AI did. The rival sees the same notice without the hidden parts (for example "the AI
  played a card for points", not which card was in hand before it was played).

**The three cases.**

- _Both sides late at once._ The sweep answers both, in a fixed order (lio, then sae), each as its own host call
  and its own log entry, so the order is explicit and replays the same. For a simultaneous pick both answers go
  in and the pick resolves as usual. Both players offline is no different: the game goes on without them. Whether
  a game where _both_ sides are autoplayed should go on at all (two AIs playing each other) is question 6.
- _A card play over several Decisions._ The sweep answers the side's next Decisions in the same run while the side
  stays "AI plays", so the absent player does not get a fresh full deadline per sub-decision. If the card pauses
  for the rival, the rival gets their normal deadline; when it comes back, the next sweep (or the same commit,
  if the host returns a "deadline now" effect) answers again. `nextClock` needs the same change as in Option A.
- _Accepted after the deadline, recorded for replay._ Only the sweep's host call accepts an answer for a late
  side; `hostSubmit` is unchanged and still refuses a late human answer. The log entry is an ordinary answer, so
  replay verification holds. The AI's own random noise is not part of the game and need not be replayed (the
  chosen answer is in the log), but it must not come from the game's seed; a seed made from the match id and seq
  is enough.

**Trade-offs.**

- _Fairness and cheating._ Strongest. Nobody can choose the answer but the AI, and it sees exactly one side's
  view. The rival cannot influence it. The fairness argument behind Decision 8 ("an AI that sees only its own
  view") still holds; only the place it runs changes.
- _Running cost._ One Easy AI call per missed Decision on an Edge Function: small at Easy, larger at higher
  tiers. Engine and AI code are bundled into the function, so its size and cold start grow.
- _Reliability._ Best: it works whether or not anyone is online, and retries each minute.
- _Work by package._ **host**: the third rule, an "AI plays" mark on the clock, the view-for-autoplay function and
  the autoplay host call, `nextClock` change, the autoplay marker. **server**: the sweep runs the AI for late
  sides under the AI rule, answers follow-up Decisions, queues the alert; the Edge Function bundles `ai`.
  **app**: the notice, the lobby choice. **ai**: nothing new, perhaps a server-friendly entry without a worker.
- _Migration or architecture change._ **Changes docs/architecture.md**: Decision 8's "Rules out: server-side AI"
  and the import table (server may import `ai`). Both are the owner's. A migration only as in Option A.

---

## Option C: a simple stand-in that is not the AI

**In one sentence.** Under this rule, a missed Decision is answered by a fixed default chosen by the host from
the engine's list of legal answers, with no AI and no view.

- **Who runs it, on what device.** The server's deadline sweep, through the host. No AI runs anywhere.
- **What view it receives, and how that is proven.** None: the host already holds `GameState` (allowed by hard
  rule 2) and calls the engine's `legalAnswers(ruleset, state, side)`, which returns the finite list of answers
  that side may give. It picks one by a fixed rule. Nothing new goes to any client. Proof: a host test that the
  stand-in answer is always in `legalAnswers` for that side, and the existing leak tests on frames.
- **How the answer reaches the game.** The same host-and-commit path as Option B (a host call the sweep makes,
  saved with the seq check). The question about hard rule 7 is the same (question 7).
- **How the server tells it apart from the player's own answer.** As in Option B: only the sweep can make it, and
  it records the log position as a stand-in.
- **If that device is offline.** Not an issue; no device is needed.
- **Which AI tier.** None. This is a stand-in, not the AI, so it does not deliver the product call as written
  ("the AI plays the missed turn"); the owner would be changing that call to "a default answer".
- **How many missed Decisions.** Any of the three spans, as in Option B.
- **What the player is told.** "Your deadline passed; the default move was made for you: ...", by turn alert and
  in-game notice; the rival sees the public part.

**The three cases.**

- _Both sides late at once._ The host answers both, lio then sae, each its own log entry; a simultaneous pick
  resolves as usual.
- _A card play over several Decisions._ As Option B: the host answers each next Decision for the side at once
  while the stand-in applies, so no fresh full deadline per sub-decision.
- _Accepted after the deadline, recorded for replay._ As Option B. The stand-in is also deterministic (no noise),
  so anyone can re-derive it from the state.

**Trade-offs.**

- _Fairness and cheating._ No cheating route. But the default may be a very poor move (for example "the first
  legal answer" may give away points or a card), which punishes the absent player more than an AI would, and a
  rival could learn to exploit a predictable default. Which default is fair for each Decision kind is a game-design
  choice (question 3), not something this file can pick.
- _Running cost._ Lowest: one engine call per missed Decision.
- _Reliability._ As Option B.
- _Work by package._ **host**: the third rule, the stand-in choice, the host call, `nextClock` change, the marker.
  **server**: the sweep applies it. **app**: the notice, the lobby choice. **ai**: nothing.
- _Migration or architecture change._ Decision 8 unchanged. The product call's wording ("the AI plays") would
  change: docs/architecture.md's deadline row, the owner's change. A migration only as in Option A.

---

## Ruled out: the rival's device plays the late side with the AI

This was considered and is **not offered**. To choose a card the AI needs the late side's `PlayerView`, and that
view holds the late side's private compartment (`mine`): its hidden hand and any unrevealed simultaneous pick.
Sending it to the rival's device puts the opponent's hidden cards on the rival's client, which Decision 2
("only views leave the host", each viewer getting only its own private compartment) and the "Never" list in
CLAUDE.md (no hidden cards anywhere a client can see them) forbid. Stripping `mine` to null avoids the leak but leaves the AI
nothing to choose from. There is no third way: any version where the rival's device runs the AI must either show
it the hand or not let it play. It also lets the rival choose their opponent's moves, since the server cannot
check what the rival's device sends.

## Side by side

|                            | A: late player's device          | B: server runs the AI | C: stand-in, no AI                |
| -------------------------- | -------------------------------- | --------------------- | --------------------------------- |
| Decision 8                 | unchanged                        | changed (owner)       | unchanged                         |
| Matches the product call   | yes                              | yes                   | no, it becomes "a default answer" |
| Can the late player cheat  | yes, the server cannot check     | no                    | no                                |
| Works with the player away | no, waits for them (needs a cap) | yes                   | yes                               |
| Server cost                | none                             | small at Easy         | lowest                            |
| Both players offline       | game waits for the cap           | game goes on          | game goes on                      |

## Questions for the owner

1. Which option, if any? Or a mix, for example B while Decision 8 is changed, and C until then?
2. How much does the AI cover once a side is late: one Decision, the rest of that turn, or every Decision until
   the player makes a move of their own again?
3. For Option C: which default answer counts as fair for each kind of Decision (pass, the first legal answer, the
   cheapest, something else)? That is a game-design choice.
4. For Option A: how long may a side stay "AI due" before it loses on time anyway?
5. Which AI tier plays: always Easy, the tier the game's creator picks in the lobby, or (Option A) the player's
   own?
6. When both sides are late and both are being played for, does the game carry on (AI against AI), end in a draw
   as a missed simultaneous pick does today, or something else?
7. Hard rule 7 says only `submit` writes game state. Today's deadline sweep already writes through the same host
   and seq-checked commit. Should an autoplayed answer count as written "through `submit`" on the same footing,
   or must it literally call the `submit` function?
8. Should both players see which moves the AI (or the stand-in) made, or only the player it played for?
9. Does a late side that the AI played for keep or lose its grace extension, and can the AI rule be combined with
   a grace extension at all (grace first, then the AI)?
