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

- **By era**: one row per era (era-1, era-2, era-3, future). Which era a card belongs to comes from the card itself
  (its `era`), not from its id.
  - **cards**: how many cards that era has in this run's games;
  - **used per game**: on average, how many different cards of that era were picked or played in one game by
    either side. A card both sides used in the same game counts once, so this never exceeds **cards**;
  - **share used**: that number out of the era's cards (0.250 means a quarter of them, on average);
  - **uses per game**: on average, all picks plus plays of that era's cards in one game.
  - An era the run leaves out shows "left out" and no numbers.

Averages are rounded to 2 decimal places and shares to 3. These numbers come from Easy AI games of a TEST
scenario with no victory rule, so they show how the cards flow through a game, not whether the design is good.

## Other turn counts, plays per turn and era arrival turns

These options change only this run's games. No scenario file, card, or game rule changes, and the hand size stays
the scenario's 8.

```
node tools/balance/run.mjs --turns 6                         # 6 turns instead of 4
node tools/balance/run.mjs --plays 2                         # 2 plays per turn instead of 1
node tools/balance/run.mjs --era era-2@3 --era era-3@5 --turns 6   # era-2 cards enter on turn 3, era-3 on turn 5
node tools/balance/run.mjs --turns 2 --era era-3@off --era future@off  # 2 turns, era-3 and future left out
```

- `--turns <n>` and `--plays <n>` take a whole number, 1 or more.
- `--era <era id>@<turn>` sets the turn on which that era's cards join the draw pile; `--era <era id>@off` leaves
  that era's cards out of the game. Use it once per era. Eras you do not name keep the TEST scenario's turns
  (era-2 on turn 2, era-3 on turn 3, future on turn 4), so a run with fewer turns must also move or leave out the
  later eras. era-1 cannot be moved: its cards are always in from turn 1.
- A badly written value, an era named twice, era-1, or an era id the first deck does not have is refused with the
  usage line, and no game is played.
- The game itself refuses some combinations: an era entering on turn 1 or after the last turn, or two eras on the
  same turn. The tool does not check these itself; it stops and prints the host's error code (`invalidSetup`).

The report's first line states the turns, plays per turn and each era's arrival turn (or "left out") that the run
used; `--json` has the same numbers under `setup`.
