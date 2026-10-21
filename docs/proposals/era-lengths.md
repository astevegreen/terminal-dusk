Proposal, not a rule

# Era lengths and turns per era: options

Sprint backlog X4. docs/design/eras.md fixes the three eras and their years (the base game runs 1991-2025 and
always stops at 2025) but leaves open how many turns each era lasts. docs/design/core-loop.md leaves open how many
cards each player plays per turn. This file lays out three options for era lengths, with trade-offs backed by
numbers from the balance tool. It decides nothing, and nothing here is a rule until the owner picks an option and
it is promoted into docs/design/.

## What the numbers are, and are not

- Every number marked "tool" comes from `node tools/balance/run.mjs` (tools/balance/README.md). Each table names
  the run it comes from, and every run's exact command is listed under its table, so anyone can rerun it. The same
  command always prints the same report.
- **The numbers come from Easy AI games of a TEST scenario with no victory rule.** Every game ends at the turn
  limit with no winner. So they measure card flow (how many of each era's cards a game uses) and game length (how
  many answers a game takes), not which side wins or whether the game is fun.
- Numbers marked "by hand" are plain arithmetic done for this file, not tool output.
- The hand size is 8 throughout (the owner's, deck-plan.md "Counts and hand size"); the tool never changes it.
- Plays per turn are not decided (core-loop.md "Not decided yet"). Every table states the plays per turn its
  numbers assume, and each option shows 1, 2 and 3 plays per turn for the base game and 1 and 2 for the others.
- Base-game runs leave the future cards out (`--era future@off`). First-era-alone runs leave out every later era
  (`--era era-2@off --era era-3@off --era future@off`). 2025-2027 scenario runs put the future cards in.
- All runs use `--games 200 --seed x4b`.

## Facts every option shares

- **Card counts per era** (from the era files and the tool's "By era" table):

  | Era    | Years     | Years long | LIO | SAE | Neutral | Total |
  | ------ | --------- | ---------- | --- | --- | ------- | ----- |
  | Era 1  | 1991-2001 | 10         | 8   | 13  | 7       | 28    |
  | Era 2  | 2001-2008 | 7          | 10  | 11  | 8       | 29    |
  | Era 3  | 2008-2025 | 17         | 8   | 12  | 8       | 28    |
  | Future | 2025-2027 | 2          | 2   | 2   | 2       | 6     |

  The base game has 85 cards and the full ruleset 91. deck-plan.md's two summary tables ("The deck at a glance"
  and the built Ops spread under "Ops spread") still count Era 3 as 27 cards with 7 neutral, and the deck as 90
  (84 without the future cards): they omit e3-neu-009 "October 7 and Gaza", added after Owner question 14. The
  counts above follow era-3.md, the ruleset and the tool, which all have 28.

- **The LIO/SAE gap** (deck-plan.md; backlog X5 looks at fixes): SAE has 5 more cards than LIO in Era 1, 1 more
  in Era 2 and 4 more in Era 3. By hand: a hand of 8 drawn from Era 1 alone holds on average 8 x 8 / 28 = 2.3
  LIO cards and 8 x 13 / 28 = 3.7 SAE cards.
- **How cards flow** (core-loop.md "Refilling hands"): every turn both hands refill to 8 from one shared draw
  pile. Each side spends 1 opening card plus its plays, so by hand a turn takes 2 x (1 + plays) cards out of the
  hands: 4 at 1 play, 6 at 2 plays, 8 at 3 plays. Turn 1 deals 16 of Era 1's 28 cards. A new era's cards are
  shuffled into the draw pile only, so they reach a hand only as fast as the hands are spent. This is why every
  option below uses far fewer of a late era's cards than of Era 1's, and why an era that enters on the last turn
  barely shows (the future rows below).
- **Scenario data** (docs/architecture.md, Decision 4 "Scenarios"): turn counts and era arrival turns are scenario
  data, so any option is a scenario file, and a first-era-alone game for free players (Product calls: free players
  play "the first era" against the AI) can be its own scenario with its own turn count.
- **Map and scoring are not decided** (W7, X2). No option below depends on them. Where an option's merit would
  change once scoring exists, it says so.

## Option A. Turns follow the years (3 / 2 / 5)

Each turn covers about the same span of history: by hand, 10 / 3 = 3.3 years per turn in Era 1, 7 / 2 = 3.5 in
Era 2 and 17 / 5 = 3.4 in Era 3.

| Era 1 turns | Era 2 turns | Era 3 turns | Era 2 enters | Era 3 enters | Base game | 2025-2027 scenario                  |
| ----------- | ----------- | ----------- | ------------ | ------------ | --------- | ----------------------------------- |
| 3 (1-3)     | 2 (4-5)     | 5 (6-10)    | turn 4       | turn 6       | 10 turns  | future cards enter on turn 11 of 11 |

The 2025-2027 scenario adds one turn, because by hand 2 years is about one 3.4-year turn.

**Base game (tool)**

| Run | Plays per turn | Answers per game | Era 1 used (share) | Era 2 used (share) | Era 3 used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------ | ------------------ |
| A1  | 1              | 62.79            | 21.17 (0.756)      | 11.02 (0.380)      | 7.82 (0.279)       |
| A2  | 2              | 95.52            | 25.25 (0.902)      | 19.36 (0.667)      | 15.4 (0.550)       |
| A3  | 3              | 129.25           | 26.38 (0.942)      | 21.4 (0.738)       | 18.04 (0.644)      |

"Used" is the tool's "used per game" (different cards of that era picked or played in one game); "share" is its
"share used". In A3, Era 1 cards are used 40.57 times per game ("uses per game"), so many are played twice after
the discard pile is reshuffled.

```
A1: node tools/balance/run.mjs --games 200 --seed x4b --turns 10 --plays 1 --era era-2@4 --era era-3@6 --era future@off
A2: node tools/balance/run.mjs --games 200 --seed x4b --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off
A3: node tools/balance/run.mjs --games 200 --seed x4b --turns 10 --plays 3 --era era-2@4 --era era-3@6 --era future@off
```

**First era alone, 3 turns (tool)**: see runs F3-1 and F3-2 under "First era alone" below (18.65 and 28.56
answers per game; 0.429 and 0.643 of Era 1's cards used).

**2025-2027 scenario (tool)**

| Run | Plays per turn | Answers per game | Era 3 used (share) | Future used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------- |
| AF1 | 1              | 68.94            | 9.53 (0.340)       | 0.32 (0.053)        |
| AF2 | 2              | 104.71           | 18.16 (0.648)      | 0.89 (0.148)        |

```
AF1: node tools/balance/run.mjs --games 200 --seed x4b --turns 11 --plays 1 --era era-2@4 --era era-3@6 --era future@11
AF2: node tools/balance/run.mjs --games 200 --seed x4b --turns 11 --plays 2 --era era-2@4 --era era-3@6 --era future@11
```

**Trade-offs**

- Card use: Era 3 gets 5 turns, so it is the best used of the three options' Era 3 (0.279 at 1 play, 0.550 at 2,
  runs A1 and A2). Era 2 has only 2 turns, but its share is about the same as option B's 3-turn Era 2 (0.380 in A1
  against 0.370 in B1), because its cards stay in the hands after Era 3 enters.
- Game length: the longest base game of the three (62.79 to 129.25 answers per game, A1 to A3).
- First era alone: 3 turns, the same as option B. At 1 play per turn it is short (18.65 answers per game, run
  F3-1) and uses under half of Era 1's cards; at 2 plays it uses about two thirds (0.643, run F3-2).
- Years to turns: the most even mapping; one turn is always about 3.4 years, so the history keeps one pace.
- LIO/SAE gap: Era 3's gap (4 cards) lasts half the game (turns 6-10), the longest exposure to a large gap of
  any option. Era 1's gap (5 cards) lasts 3 of 10 turns, and Era 2, the most even era, gets the fewest turns.
- Once scoring exists: if eras end with scoring, Era 2 has only 2 turns to build toward it, which may make that
  era's scoring feel rushed; the merit of this option depends on that.

## Option B. Equal turns per era (3 / 3 / 3)

Every era gets the same number of turns, so every era's cards get the same time in play before the next era
enters. By hand: 10 / 3 = 3.3 years per turn in Era 1, 7 / 3 = 2.3 in Era 2 and 17 / 3 = 5.7 in Era 3.

| Era 1 turns | Era 2 turns | Era 3 turns | Era 2 enters | Era 3 enters | Base game | 2025-2027 scenario                  |
| ----------- | ----------- | ----------- | ------------ | ------------ | --------- | ----------------------------------- |
| 3 (1-3)     | 3 (4-6)     | 3 (7-9)     | turn 4       | turn 7       | 9 turns   | future cards enter on turn 10 of 10 |

The 2025-2027 scenario adds one turn; by hand 2 years is less than one 5.7-year Era 3 turn, so it could also be
argued as no extra turn at all (a question below).

**Base game (tool)**

| Run | Plays per turn | Answers per game | Era 1 used (share) | Era 2 used (share) | Era 3 used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------ | ------------------ |
| B1  | 1              | 55.83            | 20.7 (0.739)       | 10.73 (0.370)      | 4.57 (0.163)       |
| B2  | 2              | 85.5             | 24.89 (0.889)      | 18.82 (0.649)      | 10.29 (0.368)      |
| B3  | 3              | 115.51           | 25.9 (0.925)       | 20.16 (0.695)      | 12.54 (0.448)      |

```
B1: node tools/balance/run.mjs --games 200 --seed x4b --turns 9 --plays 1 --era era-2@4 --era era-3@7 --era future@off
B2: node tools/balance/run.mjs --games 200 --seed x4b --turns 9 --plays 2 --era era-2@4 --era era-3@7 --era future@off
B3: node tools/balance/run.mjs --games 200 --seed x4b --turns 9 --plays 3 --era era-2@4 --era era-3@7 --era future@off
```

**First era alone, 3 turns (tool)**: the same as option A, runs F3-1 and F3-2 below.

**2025-2027 scenario (tool)**

| Run | Plays per turn | Answers per game | Era 3 used (share) | Future used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------- |
| BF1 | 1              | 62.09            | 6.4 (0.229)        | 0.23 (0.038)        |
| BF2 | 2              | 94.94            | 13.51 (0.482)      | 0.75 (0.124)        |

```
BF1: node tools/balance/run.mjs --games 200 --seed x4b --turns 10 --plays 1 --era era-2@4 --era era-3@7 --era future@10
BF2: node tools/balance/run.mjs --games 200 --seed x4b --turns 10 --plays 2 --era era-2@4 --era era-3@7 --era future@10
```

**Trade-offs**

- Card use: equal turns do not give equal use. Because a new era's cards only enter the draw pile, Era 3 arrives
  late into hands still full of older cards and is the least used era (0.163 at 1 play, run B1; 0.368 at 2, run
  B2), well below option A.
- Game length: in the middle (55.83 to 115.51 answers per game, B1 to B3); one turn shorter than option A.
- First era alone: 3 turns, the same as option A (runs F3-1, F3-2).
- Years to turns: the most uneven pace of the three in Era 3: Era 2's 7 years and Era 3's 17 years both get 3
  turns, so one Era 3 turn covers about 2.5 times the years of an Era 2 turn (by hand, 5.7 / 2.3).
- LIO/SAE gap: Era 3's gap (4 cards) is short-lived and its cards are few in hands, so it shows least in this
  option; Era 1's gap (5 cards) lasts a third of the game, and Era 1 cards stay in play after Era 2 enters (by
  hand: B1 uses 36 cards per game, 12 in turns 1-3, and 20.7 of its uses are Era 1 cards, so about 8.7 Era 1
  uses come after turn 3).
- Once scoring exists: equal-length eras make any per-era scoring evenly spaced, which would favour this option;
  without scoring that merit is not visible.

## Option C. A short game (2 / 2 / 2)

The shortest base game: each era gets 2 turns. By hand: 10 / 2 = 5 years per turn in Era 1, 7 / 2 = 3.5 in Era 2
and 17 / 2 = 8.5 in Era 3.

| Era 1 turns | Era 2 turns | Era 3 turns | Era 2 enters | Era 3 enters | Base game | 2025-2027 scenario                |
| ----------- | ----------- | ----------- | ------------ | ------------ | --------- | --------------------------------- |
| 2 (1-2)     | 2 (3-4)     | 2 (5-6)     | turn 3       | turn 5       | 6 turns   | future cards enter on turn 7 of 7 |

**Base game (tool)**

| Run | Plays per turn | Answers per game | Era 1 used (share) | Era 2 used (share) | Era 3 used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------ | ------------------ |
| C1  | 1              | 37.39            | 16.17 (0.577)      | 5.59 (0.193)       | 2.25 (0.080)       |
| C2  | 2              | 56.7             | 20.38 (0.728)      | 10.88 (0.375)      | 4.75 (0.169)       |
| C3  | 3              | 76.86            | 23.84 (0.851)      | 16.11 (0.556)      | 8.05 (0.288)       |

```
C1: node tools/balance/run.mjs --games 200 --seed x4b --turns 6 --plays 1 --era era-2@3 --era era-3@5 --era future@off
C2: node tools/balance/run.mjs --games 200 --seed x4b --turns 6 --plays 2 --era era-2@3 --era era-3@5 --era future@off
C3: node tools/balance/run.mjs --games 200 --seed x4b --turns 6 --plays 3 --era era-2@3 --era era-3@5 --era future@off
```

**First era alone, 2 turns (tool)**: runs F2-1 and F2-2 below (12.46 and 18.93 answers per game; 0.286 and 0.429
of Era 1's cards used).

**2025-2027 scenario (tool)**

| Run | Plays per turn | Answers per game | Era 3 used (share) | Future used (share) |
| --- | -------------- | ---------------- | ------------------ | ------------------- |
| CF1 | 1              | 43.85            | 3.73 (0.133)       | 0.11 (0.018)        |
| CF2 | 2              | 66.31            | 7.37 (0.263)       | 0.41 (0.068)        |

```
CF1: node tools/balance/run.mjs --games 200 --seed x4b --turns 7 --plays 1 --era era-2@3 --era era-3@5 --era future@7
CF2: node tools/balance/run.mjs --games 200 --seed x4b --turns 7 --plays 2 --era era-2@3 --era era-3@5 --era future@7
```

**Trade-offs**

- Card use: the lowest of the three. At 1 play per turn a game sees under a fifth of Era 2's cards and under a
  tenth of Era 3's (0.193 and 0.080, run C1). Only at 3 plays per turn does a game reach about half of Era 2
  (0.556, run C3). Most of the deck would sit unused in a typical game.
- Game length: the shortest base game (37.39 to 76.86 answers per game, C1 to C3). Even at 3 plays per turn it
  is shorter than option A at 2 plays (by hand: C3's 76.86 is 0.80 of A2's 95.52).
- First era alone: 2 turns is very short for a free player's whole game (12.46 answers per game at 1 play, run
  F2-1), unless a first-era scenario gets more turns of its own (see "First era alone" below).
- Years to turns: uneven. One Era 3 turn covers 8.5 years, more than all of Era 2 (7 years).
- LIO/SAE gap: every era is short, so each era's gap lasts only 2 turns; but since the game rarely gets past Era 1
  cards, Era 1's gap (5 cards) shows most (by hand: C1 uses 24 cards per game, and 16.17 of those uses are Era 1
  cards, about two thirds).
- Once scoring exists: a short game may suit a mobile session well, but with 2 turns per era any per-era scoring
  comes very often; its merit depends on how much a scoring card weighs.

## First era alone

Runs for a first-era-alone game: Era 1's cards only, everything else left out. Options A and B give Era 1 three
turns, option C two. A first-era scenario does not have to use its era's base-game length (Decision 4: turn counts
are scenario data), so a 5-turn run is shown for comparison; it belongs to no option.

| Run  | Turns | Plays per turn | Answers per game | Era 1 used (share) | Era 1 uses per game |
| ---- | ----- | -------------- | ---------------- | ------------------ | ------------------- |
| F2-1 | 2     | 1              | 12.46            | 8 (0.286)          | 8                   |
| F2-2 | 2     | 2              | 18.93            | 12 (0.429)         | 12                  |
| F2-3 | 2     | 3              | 25.73            | 16 (0.571)         | 16                  |
| F3-1 | 3     | 1              | 18.65            | 12 (0.429)         | 12                  |
| F3-2 | 3     | 2              | 28.56            | 18 (0.643)         | 18                  |
| F3-3 | 3     | 3              | 38.62            | 20.8 (0.743)       | 24                  |
| F5-1 | 5     | 1              | 31.14            | 17.53 (0.626)      | 20                  |
| F5-2 | 5     | 2              | 47.98            | 20.54 (0.733)      | 30                  |
| F5-3 | 5     | 3              | 64.58            | 22.46 (0.802)      | 40                  |

```
F2-1: node tools/balance/run.mjs --games 200 --seed x4b --turns 2 --plays 1 --era era-2@off --era era-3@off --era future@off
F2-2: node tools/balance/run.mjs --games 200 --seed x4b --turns 2 --plays 2 --era era-2@off --era era-3@off --era future@off
F2-3: node tools/balance/run.mjs --games 200 --seed x4b --turns 2 --plays 3 --era era-2@off --era era-3@off --era future@off
F3-1: node tools/balance/run.mjs --games 200 --seed x4b --turns 3 --plays 1 --era era-2@off --era era-3@off --era future@off
F3-2: node tools/balance/run.mjs --games 200 --seed x4b --turns 3 --plays 2 --era era-2@off --era era-3@off --era future@off
F3-3: node tools/balance/run.mjs --games 200 --seed x4b --turns 3 --plays 3 --era era-2@off --era era-3@off --era future@off
F5-1: node tools/balance/run.mjs --games 200 --seed x4b --turns 5 --plays 1 --era era-2@off --era era-3@off --era future@off
F5-2: node tools/balance/run.mjs --games 200 --seed x4b --turns 5 --plays 2 --era era-2@off --era era-3@off --era future@off
F5-3: node tools/balance/run.mjs --games 200 --seed x4b --turns 5 --plays 3 --era era-2@off --era era-3@off --era future@off
```

- When "uses per game" is higher than "used", some cards came back after the discard pile was reshuffled: from
  F3-3 on, a first-era game is longer than Era 1's 28 cards can carry without repeats.
- A first-era game is a fraction of a base game: by hand, F3-1's 18.65 answers are 0.30 of A1's 62.79 and 0.33 of
  B1's 55.83.
- Era 1's LIO/SAE gap (8 LIO, 13 SAE) is the whole deck of a first-era game, so whatever X5 does about the gap
  matters most here.

## The options at a glance

| Option | Turns (Era 1 / 2 / 3) | Era 2 / Era 3 enter | Base game | 2025-2027 | Years per turn (by hand) | Era 3 share at 1 / 2 plays |
| ------ | --------------------- | ------------------- | --------- | --------- | ------------------------ | -------------------------- |
| A      | 3 / 2 / 5             | 4 / 6               | 10 turns  | 11 turns  | 3.3 / 3.5 / 3.4          | 0.279 / 0.550 (A1, A2)     |
| B      | 3 / 3 / 3             | 4 / 7               | 9 turns   | 10 turns  | 3.3 / 2.3 / 5.7          | 0.163 / 0.368 (B1, B2)     |
| C      | 2 / 2 / 2             | 3 / 5               | 6 turns   | 7 turns   | 5 / 3.5 / 8.5            | 0.080 / 0.169 (C1, C2)     |

In every option the future cards, entering on the last turn, are barely used (at most 0.148 of them, run AF2).

## Questions for the owner

1. Which option, or another split, should be taken further: turns that follow the years (A), equal turns per era
   (B), or a short game (C)?
2. How many plays per turn should the numbers assume? In every option the share of Era 2 and Era 3
   cards used grows by between three quarters and double from 1 to 2 plays.
3. Should a free player's first-era game use Era 1's base-game length, or be its own scenario with more turns
   (for example 5, runs F5-1 to F5-3)?
4. Should the 2025-2027 scenario add a turn after 2025 (as all three options show here), or put the future cards
   in during the last turn of Era 3? Entering on the last turn, they barely reach a hand.
5. A new era's cards only join the draw pile (eras.md), so a late era is used far less than Era 1. Is that the
   intended feel, or should this be looked at with the era rules?
6. Should deck-plan.md's two summary tables be corrected to 28 Era 3 cards (8 neutral) and 91 in all?
