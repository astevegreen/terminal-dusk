Proposal, not a rule

# A balance pass on the six-region map

Research lane X15 (#472). The six-region map's numbers were chosen on 28 October (map-numbers option A, with the
track starting in the middle; R24, #458/#459). The AI arena (X14, #463) now lets two Medium AI players play each other,
so this pass asks one question: with both sides played equally well, does the map favour one side? It does: **LIO
wins about 63% of games**. This proposal lays out three ways to even it out, each with a smoke run. It decides nothing
and changes no game data: the options exist only as numbers files the balance tool lays over the map for a run.

## How the runs were made

```
node tools/balance/run.mjs --scenario six-region --games 1000 --seed x15 --lio-tier medium --sae-tier medium
node tools/balance/run.mjs --scenario six-region --games 1000 --seed x15 --lio-tier medium --sae-tier medium --numbers docs/proposals/map-balance/option-1-taiwan.json
```

(and the same with `option-2-amounts.json` and `option-3-track.json`). Each run is 1,000 seeded games of Medium
against Medium through the match host, as a real match plays, and takes about 3 to 4 minutes. The same command always
prints the same report.

**Why 1,000 games.** With 1,000 games a win share is known to within about 3 points either way (95% of the time).
That is enough to tell 63% from 50% beyond doubt, and to tell options apart when they differ by 5 points or more. A
second run with another seed (`--seed x15b`) gave the same 62.7% LIO win share, so the result is not luck of the deck.

**What this does not cover.** The scenario's turns, plays per turn and hand size are still placeholders (4 turns, 1
play a turn). The cards are the first deck. Both players are the same Medium AI, which plays well but not like a
person. So a number here is a direction to move, not the final size of a fix: the map should be checked again once
the real turn structure and the Hard AI exist.

## What happens today (the chosen numbers)

### Who wins

| Side | Wins | Share     |
| ---- | ---- | --------- |
| LIO  | 627  | **62.7%** |
| SAE  | 356  | 35.6%     |
| Draw | 17   | 1.7%      |

### How games end

| Way the game ended                       | Games | LIO wins | SAE wins |
| ---------------------------------------- | ----- | -------- | -------- |
| A side pushed the score track to its end | 439   | 315      | 124      |
| The side ahead after the last era won    | 544   | 312      | 232      |
| An even track (a draw for now)           | 17    | -        | -        |
| A crisis                                 | 0     | -        | -        |

LIO's lead is largest in the quick wins: when a game ends early at a track end, LIO wins it 72% of the time. No
crisis happened in any game: the Medium AI never lets Escalation reach 6. (In the rules a crisis does not end the game
itself: it costs the side that caused it score, which could push the track to an end.) The draws are games the rules would settle by the tech race, which
the tool cannot measure yet.

### Score by era

Points each side got when the era scored, on average, and the net swing (SAE minus LIO: negative helps LIO).

| Era    | Games that reached it | LIO points | SAE points | Swing |
| ------ | --------------------- | ---------- | ---------- | ----- |
| Era 1  | 1000                  | 6.3        | 4.75       | -1.56 |
| Era 2  | 1000                  | 7.41       | 7.27       | -0.14 |
| Era 3  | 893                   | 7.15       | 4.75       | -2.40 |
| Future | 710                   | 7.05       | 4.89       | -2.16 |

LIO gains in every era but Era 2, which is close to even. Era 2 is also the one era whose battleground list leaves out
Taiwan (see below).

### Which regions decide games

"Decided" means the region pushed the track over its end, or moved it most towards the winner.

| Region                          | LIO points | SAE points | Swing     | Decided |
| ------------------------------- | ---------- | ---------- | --------- | ------- |
| Eastern Europe and Central Asia | 10.36      | 14.17      | **+3.81** | 43%     |
| East and South Asia             | 10.97      | 4.59       | **-6.38** | 39%     |
| The Americas                    | 3.25       | 0.70       | -2.55     | 14%     |
| Europe                          | 0.23       | 0.04       | -0.20     | 1%      |
| Middle East and North Africa    | 0.09       | 0.11       | +0.02     | 0%      |
| Sub-Saharan Africa              | 0.19       | 0.12       | -0.07     | 1%      |

Three regions decide almost every game. SAE wins Eastern Europe and Central Asia, as expected next to its home box.
But LIO wins East and South Asia by even more, although that region also touches the SAE home box. The likely reason
is **Taiwan**: it starts with 3 LIO influence and is controlled by LIO from turn 1 (stability 3). It is a battleground
in Era 1, Era 3 and the future era, and holding it from the start makes LIO "present" or "ahead" in the region before
SAE has played a card. The Americas, next to the LIO home box, add a smaller LIO gain.

Europe, the Middle East and North Africa, and Sub-Saharan Africa almost never score for anyone in these games. That is
a separate question from the side balance (it probably comes from the short placeholder game and from both AIs
spending near their home boxes) and is noted under "Other findings".

### The tech race action

The tech race action is used, but rarely: 84 attempts in 1,000 games, 82 of them by SAE. The Medium AI has no plan for
the tech race yet (that is A17, being built now); it tries each legal answer by looking one step ahead, and the race
sometimes comes out best, mostly for SAE. The count will change once A17 lands, and the balance should be checked
again then. The balance tool now prints this count on its "Tiers" line.

## The options

Each option is a numbers file in [map-balance/](map-balance/), laid over the map for a run only. All runs use the same
1,000 seeds, so they differ only by the option.

| Run                                              | LIO wins | SAE wins | Draws | Track end on average |
| ------------------------------------------------ | -------- | -------- | ----- | -------------------- |
| Today (option A as chosen)                       | 62.7%    | 35.6%    | 1.7%  | 5.0 towards LIO      |
| Option 1: Taiwan starts at LIO 2                 | 53.6%    | 44.3%    | 2.1%  | 1.6 towards LIO      |
| Option 2: lower amounts in Asia and the Americas | 60.1%    | 37.7%    | 2.2%  | 4.0 towards LIO      |
| Option 3: the track starts 4 towards SAE         | 54.8%    | 43.8%    | 1.4%  | 2.2 towards LIO      |

### Option 1: Taiwan starts at LIO 2 ([option-1-taiwan.json](map-balance/option-1-taiwan.json))

Taiwan keeps stability 3 and starts with 2 LIO influence instead of 3, so it is LIO-aligned but not LIO-controlled
at the start. LIO must spend one more point to control it; SAE can contest it more cheaply.

- **Effect:** LIO's win share falls from 62.7% to 53.6%, the largest move of the three. East and South Asia's swing
  shrinks only a little (-6.38 to -5.76); the gain shows up across the whole game, as LIO spends a point on Taiwan it
  used to spend elsewhere.
- **For:** a small, local change aimed at the likely cause. The history still reads well: Taiwan leans to LIO in 1991
  without being locked in.
- **Against:** it touches a choice the owner made on purpose ("Taiwan starts LIO-aligned"). Whether "aligned" means
  "controlled" is the owner's call. On its own it still leaves LIO a little ahead.

### Option 2: lower amounts in East and South Asia and the Americas ([option-2-amounts.json](map-balance/option-2-amounts.json))

East and South Asia scores 2 / 4 / 6 (present / ahead / every battleground) instead of 2 / 5 / 8; the Americas 1 / 2
/ 4 instead of 1 / 3 / 5. The regions where LIO gains are worth less.

- **Effect:** small: LIO's win share falls only to 60.1%, inside the run-to-run noise of the baseline. The swing in
  East and South Asia drops (-6.38 to -5.60) but LIO still wins it most games.
- **For:** leaves the starting position and history untouched; changes only the scoring table.
- **Against:** it barely works. It also makes East and South Asia worth less than the other two closing regions,
  which went against option A's idea that the three frontier regions score most. A larger cut would move more but
  would empty the region of meaning.

### Option 3: the track starts 4 steps towards SAE ([option-3-track.json](map-balance/option-3-track.json))

The score track starts at 4 on SAE's side (of 20 to each end) instead of the middle. Nothing on the map changes.

- **Effect:** LIO's win share falls to 54.8%. A further run with the start at 6 gave LIO 51.2%, SAE 47.0%, so the
  start can be tuned in steps.
- **For:** one number, easy to tune later as the AI and the turn structure change; it does not touch the map.
- **Against:** it reverses the owner's 28 October choice to start the track in the middle. It hides the cause instead
  of fixing it: Taiwan and East and South Asia still swing towards LIO, and a player sees SAE "ahead" before any card
  is played, which may need a story reason (for example, SAE's head start in 1991's regional pressure).

### A combination

Options 1 and 3 can be combined, each at a smaller size. A run with Taiwan at LIO 2 and the track starting 2 towards
SAE gave **LIO 49.6%, SAE 48.6%, draws 1.8%**, the closest to even of every run. It is not an option file of its own
because it is two decisions; the owner can take either half alone.

## Questions for the owner

1. Should the map be evened out now, or wait for the real turn structure and the Hard AI, and accept that LIO is
   ahead with today's placeholders?
2. If now, which: option 1 (Taiwan at LIO 2), option 2 (lower amounts), option 3 (the track starts towards SAE), or
   options 1 and 3 together at a smaller size?

Our recommendation is **option 1**, with the combination (Taiwan at LIO 2 and the track 2 towards SAE) if the owner
wants the map close to even now. Option 1 targets the region that decides the most LIO wins and changes the least;
the track start is the easiest number to retune later.

## Other findings (not part of the options)

- Europe, the Middle East and North Africa, and Sub-Saharan Africa almost never score (0% to 1% of games decided). With
  only 4 placeholder turns of 1 play each, both AIs spend near their home boxes. Worth checking again with the real
  turn structure; if it lasts, the map's middle is dead weight.
- The Medium AI never caused an Escalation crisis in 1,000 games, so crisis costs are not tested by these runs.
- Medium uses the tech race about once in 12 games, nearly always as SAE, without a plan for it. Recheck after A17.
