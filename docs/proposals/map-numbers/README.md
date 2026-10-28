Proposal, not a rule

# The six-region map's numbers

Research lane X12 (#438). The owner's 28 October answers settled the six-region map's countries, its neighbours,
the closing order and how a region scores, but left its numbers open (`docs/design/map-and-points.md`, "Owner's
remaining questions" 3, and the Scoring section's "Open" line). This proposal lays out three complete sets of those
numbers, with trade-offs and a smoke run of each. It decides nothing and recommends nothing; nothing here is a rule
until the owner picks and it is promoted into `docs/design/`.

| File                                       | What it holds                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| This README                                | The questions, what every option shares, the comparison, the smoke runs, how to rerun them, the questions for the owner |
| [option-a-history.md](option-a-history.md) | Option A: history-led. Stabilities and battlegrounds follow the period; the frontier regions score most                 |
| [option-b-balance.md](option-b-balance.md) | Option B: balance-led. Offsets the SAE box's reach; 2 battlegrounds a region; even amounts                              |
| [option-c-simple.md](option-c-simple.md)   | Option C: simple and flat. Keeps the placeholders; a few battleground swaps; even amounts                               |

Each option also has a `.json` file with its stabilities, battleground lists and starting influence, in the form
the balance tool reads (`tools/balance/README.md`, "Trying other map numbers"). The amounts and the track are in
the option files' `scoring` block too, which the balance tool lays over the map for a run (see "Scoring smoke
runs" below).

## The questions this answers

1. Each country's stability (42 countries).
2. Each era's battleground list: Era 1, Era 2, Era 3, and the list for the future era of the 2025-2027 scenario.
3. For each region, the amounts for present, ahead and holding every battleground.
4. The score track's length, and where it starts.
5. Taiwan's and Crimea's starting influence.

## Settled, and not reopened here

- The countries, regions, neighbours and home boxes of map-content option 2, with H1 and Crimea as its own box.
- The closing order C1 and scoring order S1: Eastern Europe and Central Asia, East and South Asia, Europe close at
  Escalation 3, 4 and 5; those three then the Middle East and North Africa, Sub-Saharan Africa and the Americas
  score in that order.
- How a region scores (map-and-points.md, "Scoring"): present, ahead, every battleground; the highest level only,
  plus 1 per battleground; each region moves the one track by the difference; reaching an end wins at once; the
  side ahead after 2025 wins, then the tech race, then a draw.
- Taiwan starts LIO-aligned; Crimea starts as the history of 1991 says.

## The options side by side

|                                                           | A: history-led                                                                                                   | B: balance-led                  | C: simple and flat                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------- |
| Stabilities changed (of 42)                               | 7                                                                                                                | 22                              | 0                                   |
| Countries at stability 1 / 2 / 3 / 4                      | 10 / 9 / 14 / 9                                                                                                  | 2 / 18 / 21 / 1                 | 8 / 15 / 11 / 8                     |
| SAE box's 17 neighbours, total stability                  | 42                                                                                                               | 46                              | 40                                  |
| LIO box's 3 neighbours, total stability                   | 9                                                                                                                | 7                               | 9                                   |
| Battlegrounds, Era 1 / 2 / 3                              | 19 / 20 / 19                                                                                                     | 12 / 12 / 12                    | 17 / 17 / 17                        |
| Battlegrounds per region                                  | 2 to 4, varies by era                                                                                            | 2 everywhere                    | 3 (Sub-Saharan Africa 2)            |
| Amounts (present / ahead / every BG)                      | 2/5/8 in the three closing regions, 2/4/6 Middle East and North Africa, 1/3/4 Sub-Saharan Africa, 1/3/5 Americas | 2/4/6 everywhere                | 1/3/5 everywhere                    |
| Track (steps from the middle to each end)                 | 20                                                                                                               | 15                              | 20                                  |
| Track start                                               | 2 towards LIO                                                                                                    | the middle                      | the middle                          |
| Largest one-era move (one side everything, rival nothing) | 58, 59, 58                                                                                                       | 48                              | 47                                  |
| Taiwan at the start                                       | LIO 3, controlled (stability 3)                                                                                  | LIO 2, controlled (stability 2) | LIO 3, controlled (stability 3)     |
| Crimea at the start                                       | SAE 1, not controlled (stability 2)                                                                              | SAE 2, controlled (stability 2) | SAE 1, not controlled (stability 2) |

The placeholders in `six-region-map.json` have 17 battlegrounds, the same list in every era, Taiwan LIO 3 and
Crimea SAE 1; option C keeps all of that for Era 1.

## Smoke runs

**What these measure, and what they do not.** Scoring and the victory rule are being built in parallel, so the
balance tool cannot score a region or move a track. These runs measure **influence and control only**: how much
influence each side has on the map, how many countries and battlegrounds it controls, and in how many regions it
would reach each scoring level at each era's end. They say nothing about who would win. Every game ends at the turn
limit as a draw. They are Easy AI games, so they show how the numbers shape play, not what good players would do.

**The assumption about turns.** Era lengths are not decided either. The runs use era-lengths option A
(`docs/proposals/era-lengths.md`): 10 turns, Era 2 entering on turn 4 and Era 3 on turn 6, with 2 plays per turn
and the future cards left out. 100 games for each set of numbers, base seed `x12`.

### At the game's end (averages per game)

| Numbers            | LIO influence | SAE influence | LIO countries | SAE countries |
| ------------------ | ------------- | ------------- | ------------- | ------------- |
| Placeholders       | 20.23         | 9.66          | 3.67          | 1.81          |
| A: history-led     | 20.26         | 11.2          | 3.5           | 1.84          |
| B: balance-led     | 9.96          | 15.04         | 1.52          | 2.2           |
| C: simple and flat | 20.23         | 9.66          | 3.67          | 1.81          |

### At each era's end (averages per game)

Battlegrounds are counted on the list of the era that is ending. "Regions" counts the highest level reached in each
of the six regions. "Every BG" is left out: its average was 0.05 regions or less for every side, era and option.

| Numbers            | Era | LIO BGs | SAE BGs | LIO regions present / ahead | SAE regions present / ahead |
| ------------------ | --- | ------- | ------- | --------------------------- | --------------------------- |
| Placeholders       | 1   | 1.03    | 0.3     | 0.62 / 0.81                 | 0.62 / 0.23                 |
|                    | 2   | 1.11    | 0.54    | 0.8 / 0.84                  | 0.62 / 0.36                 |
|                    | 3   | 1.73    | 0.66    | 1.07 / 1.27                 | 0.91 / 0.41                 |
| A: history-led     | 1   | 1.13    | 0.33    | 0.51 / 0.87                 | 0.55 / 0.28                 |
|                    | 2   | 1.04    | 0.9     | 0.83 / 0.72                 | 0.47 / 0.53                 |
|                    | 3   | 1.53    | 0.67    | 1.01 / 1.1                  | 0.92 / 0.42                 |
| B: balance-led     | 1   | 0.1     | 0.13    | 0.72 / 0.08                 | 0.69 / 0.11                 |
|                    | 2   | 0.16    | 0.28    | 0.78 / 0.15                 | 0.86 / 0.23                 |
|                    | 3   | 0.48    | 0.63    | 0.88 / 0.28                 | 1.21 / 0.4                  |
| C: simple and flat | 1   | 1.03    | 0.3     | 0.62 / 0.81                 | 0.62 / 0.23                 |
|                    | 2   | 1.38    | 0.72    | 0.76 / 0.88                 | 0.59 / 0.39                 |
|                    | 3   | 1.81    | 0.66    | 1.07 / 1.27                 | 0.91 / 0.41                 |

### What stands out

- **Very little is controlled.** At most about 4 countries of 42 for either side at the end, and under 2
  battlegrounds. With these numbers and the Easy AI, most regions score nothing or only "present" for one side,
  and holding every battleground almost never happens. The largest possible one-era moves in the table above are
  far from what these games reach.
- **LIO leads on the placeholders, A and C** (about twice SAE's control). B is the only option that turns it
  round, and turns it further than even: SAE ends ahead.
- **Battleground lists do not change play yet.** C plays exactly the games the placeholders do: Escalation rising
  for a battleground is not built, and the Easy AI does not aim at battlegrounds. So the lists change only what is
  counted at an era's end. Once battlegrounds raise Escalation and the AI weighs them, all of this will move.
- **A's Era 2 is SAE's best era** in any option (0.9 battlegrounds and ahead in 0.53 regions): its list puts
  battlegrounds on cheap countries next to the SAE box (Georgia, Kyrgyzstan and Afghanistan at stability 1,
  Pakistan at 2).

### How to rerun them

```
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-a-history.json
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-b-balance.json
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-c-simple.json
```

The same command always prints the same report. Each takes a few seconds on an idle PC. The next section runs them
again with each option's scoring on.

## Scoring smoke runs (X13, #446)

Research lane X13 (#446). The runs above measured control only, because scoring was not built. Era-end region scoring
has since merged (R21), so these runs play the same games through the real engine with each option's amounts and
track, and count what the score does. Still a proposal: nothing here recommends an option or becomes a rule.

### In plain English

These are Easy AI games, so they show what the numbers do to a game, not what good players would do. Read the
differences between options more than the exact figures.

- **Options A and C lean LIO; B leans SAE.** LIO wins 73 of 100 games on A and 75 on C; on B, SAE wins 55 and LIO
  39, with 6 draws. This follows the control runs above: B's stabilities were built to offset the SAE box's reach,
  and with the Easy AI they more than cancel it. No option is level; B is the only one that tilts towards SAE.
- **Most games go to the final count.** The side ahead after 2025 wins 63 games on A, 78 on B and 79 on C. A side
  reaches the end of the track and wins at once in 36 games on A, 21 on C and 16 on B. Nearly all of A's and C's
  track-end wins are LIO's (32 of 36, and 21 of 21).
- **Two regions decide most games under A and C.** East and South Asia and Eastern Europe and Central Asia decide
  79 of A's 99 decided games and 65 of C's 100. Europe, the Middle East and North Africa and Sub-Saharan Africa each
  decide fewer than 10 games in 100 on every option. B spreads it over three regions: Eastern Europe and Central
  Asia 28, East and South Asia 30 and the Americas 26 of its 94 decided games. Europe's average swing is close to zero on
  every option (about 0.1 either way), so its amounts barely matter in these runs.
- **The swing grows with the eras on B, and holds steady on A and C.** On B the score hardly moves in Era 1 (average
  swing +0.09 towards SAE) and builds to +1.07 in Era 3. On A and C LIO gains in every era.
- **The track.** 15 steps (B) ended 16% of games early; 20 steps ended 36% (A) and 21% (C). Most track ends come
  late: only 10 of A's 100 games ended before Era 3 scored, 3 of C's and 1 of B's. A's start 2 steps towards LIO does
  not show up: A and C lean LIO about equally (73 and 75 wins), though they differ in more than the start.

Pointers for the questions at the end, as findings and not advice: for question 3 (amounts), weighted amounts (A)
and flat ones (C) end up putting the game in the same two regions here, because the Easy AI scores in those two
and little elsewhere. For question 4 (the track), the track end was reached in one game in three to one in six,
mostly in the last era. For question 1 (stabilities), B is the only set that changes who leads, and it changes it
past even.

### What these runs assume

- **Same games as the control runs.** Era-lengths option A (`docs/proposals/era-lengths.md`): 10 turns, Era 2 on
  turn 4, Era 3 on turn 6, 2 plays per turn, the future cards left out. 100 games for each option, base seed `x12`.
  Eras score at the end of turns 3, 5 and 10.
- **Nothing was left unset.** Each option gives the track's length, its start and the amounts for every region, so
  the runs used exactly those numbers: A 20 steps starting at -2 (2 towards LIO, whose end is the negative one),
  B 15 steps from 0, C 20 steps from 0. Regions score in the map's own order (the scoring order S1). The
  placeholders were not run: the scenario has no scoring, and option C's stabilities and starting influence are the
  placeholders' (only its battleground lists differ).
- **An even track at the end is a draw in these runs.** The rule says the tech race breaks the tie, but it cannot be
  measured yet, so those games count as draws.
- **A crisis does not move the score yet.** R22 is being built in another session; these runs see only era-end
  scoring.
- **Easy AI.** It does not aim at battlegrounds or weigh the score. Everything above can move once better players or
  a scoring-aware AI play.

### Where the track ended, and how games ended

Positive favours SAE. "Track end" means a side reached its end and won at once; "ahead" is the side ahead after the
last era.

| Numbers            | Final track, average (lowest to highest) | Track end: LIO / SAE | Ahead after the last era: LIO / SAE | Even track (draw) |
| ------------------ | ---------------------------------------- | -------------------- | ----------------------------------- | ----------------- |
| A: history-led     | -7.82 (-20 to 20)                        | 32 / 4               | 41 / 22                             | 1                 |
| B: balance-led     | 1.7 (-15 to 15)                          | 5 / 11               | 34 / 44                             | 6                 |
| C: simple and flat | -7.59 (-20 to 15)                        | 21 / 0               | 54 / 25                             | 0                 |

Wins in total: A LIO 73, SAE 26; B LIO 39, SAE 55; C LIO 75, SAE 25. The rest are draws.

### Swing per era

Average points each side scored in the era, over the games that reached its scoring, and the net swing (SAE minus
LIO, so positive moves the track towards SAE). A game that ends on a track end stops scoring, so later eras have
fewer games.

| Numbers            | Era | Games | LIO points | SAE points | Swing |
| ------------------ | --- | ----- | ---------- | ---------- | ----- |
| A: history-led     | 1   | 100   | 5.98       | 2.67       | -3.31 |
|                    | 2   | 99    | 5.34       | 4.24       | -1.1  |
|                    | 3   | 90    | 6.09       | 4.12       | -1.97 |
| B: balance-led     | 1   | 100   | 1.86       | 1.95       | 0.09  |
|                    | 2   | 100   | 2.3        | 2.96       | 0.66  |
|                    | 3   | 99    | 3.32       | 4.39       | 1.07  |
| C: simple and flat | 1   | 100   | 4.08       | 1.61       | -2.47 |
|                    | 2   | 100   | 4.78       | 2.48       | -2.3  |
|                    | 3   | 97    | 5.89       | 2.71       | -3.18 |

### Swing per region, and which region decides

The swing is the average per game over the whole game (all eras added), SAE minus LIO. "Decided" counts games where
the region pushed the track over its end or, for games that went to the final count, moved the track most towards
the winner over the game. A draw has no deciding region.

| Region                          | A swing | A decided | B swing | B decided | C swing | C decided |
| ------------------------------- | ------- | --------- | ------- | --------- | ------- | --------- |
| Eastern Europe and Central Asia | 0.96    | 34        | 2.09    | 28        | -0.49   | 33        |
| East and South Asia             | -5.55   | 45        | -0.55   | 30        | -4.95   | 32        |
| Europe                          | 0.1     | 3         | 0.02    | 5         | -0.11   | 7         |
| Middle East and North Africa    | -0.33   | 5         | 0.29    | 5         | -0.89   | 7         |
| Sub-Saharan Africa              | -0.15   | 1         | 0.07    | 0         | -0.15   | 1         |
| The Americas                    | -1.2    | 11        | -0.11   | 26        | -1.65   | 20        |

East and South Asia is LIO's best region under A and C (about 5 points a game towards LIO); under B it is nearly
level.

### How to rerun them

The same commands as the control runs, with `scoring` now in each option's file. The report has a Score section, and
`--json` gives the same numbers under `score`.

```
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-a-history.json
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-b-balance.json
node tools/balance/run.mjs --scenario six-region --games 100 --seed x12 --turns 10 --plays 2 --era era-2@4 --era era-3@6 --era future@off --numbers docs/proposals/map-numbers/option-c-simple.json
```

## Mixing options

The five questions are close to independent. A stability set from one option, battleground lists from another and
amounts or a track from a third all fit together; the JSON files are split the same way. The one link is the
track's start: B's middle start assumes B's symmetric Taiwan and Crimea, and A's start towards LIO assumes A's.

## Questions for the owner

1. Which stabilities: A (history), B (offset the SAE box's reach), C (the placeholders), or a mix?
2. Which battleground lists: A (2 to 4 a region, moving with the news), B (2 a region), or C (the placeholders,
   with a few swaps)?
3. Which amounts: weighted by region (A) or the same everywhere (B or C)?
4. The track: 15 or 20 steps to each end, and does it start in the middle or towards LIO?
5. Taiwan and Crimea at the start: LIO 3 and SAE 1 (Crimea not controlled), or LIO 2 and SAE 2 (each side controls
   one)?
6. Still open from map-and-points.md: who sets the real stabilities, the owner or a balance pass once scoring
   exists. Any of these options can be the starting point for that pass.
