# Balance tool

Plays many games of the first deck between two Easy AI players and counts what happened, so we can see whether
one side or one card does better than the others.

The scenario is the first-deck TEST scenario. Its numbers (turns, plays per turn, hand size) are placeholders, and
there is no victory rule yet, so today every game ends at the turn limit with no winner. The report is a tool for
later, not a verdict on the design.

## How to run it

```
node tools/balance/run.mjs                      # 200 games, base seed "balance"
node tools/balance/run.mjs --games 50 --seed x  # 50 games from base seed "x"
node tools/balance/run.mjs --json               # the same numbers as JSON
```

`--games` must be a positive whole number. The same arguments always print the same report: game `i` (counting
from 0) uses the match seed `<base>-<i>`, and the two Easy players use seeds `2i` (LIO) and `2i+1` (SAE).

Each game runs through the match host exactly as a real match would: each player sees only its own screen
(its view and its waiting decision). When both sides must answer at once, LIO answers first.

## What the numbers mean

- **Average answers per game**: how many answers both players gave, on average.
- **Results by side**: wins, losses and draws (a game with no winner), and how often each way of ending a game
  happened (for example `turnLimitReached`).
- **Cards, per side**: one row per card, with its id and name, and for LIO and SAE separately:
  - **picks**: how often that side chose the card as its opening card for a turn;
  - **event** and **points**: how often that side played the card for its event or for its points;
  - **games**: in how many games that side picked or played the card at least once;
  - **win**: of those games, the share that side won (`-` when it never used the card; `null` in JSON).
    While no game has a winner, the report says so in one line and leaves this column out.

Every pick and play counts, so a card played twice in one game counts twice (but that game counts once in
**games**).
