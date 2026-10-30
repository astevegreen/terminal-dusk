# Balance tool

Plays many games of the first deck between two Easy AI players and counts what happened, so we can see whether
one side or one card does better than the others.

By default the scenario is the first-deck TEST scenario. Its numbers (turns, plays per turn, hand size) are
placeholders, and there is no victory rule yet, so today every game ends at the turn limit with no winner. The
report is a tool for later, not a verdict on the design.

## Choosing the scenario

```
node tools/balance/run.mjs --scenario first-deck   # the first-deck TEST scenario (the same as no --scenario)
node tools/balance/run.mjs --scenario test-map     # the made-up test map (packages/content/scenarios/test-map.json)
node tools/balance/run.mjs --scenario six-region   # the six-region map (packages/content/scenarios/six-region-map.json)
```

- `first-deck` (the default) prints exactly the report the tool printed before `--scenario` existed.
- `test-map` plays the first deck's Era 1 cards on the test map scenario, with that scenario's own numbers
  (4 turns, 1 play per turn, hands of 2), map and starting influence. The scenario has no later eras, so only Era 1
  cards play and only their rows are listed. The test map is test data, not the game's map, and there is still no
  victory rule: its report is a smoke check that the action menu works across whole games, not a verdict on balance,
  and its first line says so.
- `six-region` plays the whole first deck on the six-region map scenario, with that scenario's own numbers, map,
  battleground lists and starting influence, and the first deck's eras (the map scenario has a battleground list for
  each era but no cards of its own). The scenario itself has no scoring, so by default its report is a smoke check
  of influence and control; a `--numbers` file with a `scoring` block adds the score track and the Score section.
  Either way it is not a verdict on balance, and its first line says so.
- Any other value is refused with the allowed values and the usage line, and no game is played.

## Choosing each side's AI tier

`--lio-tier` and `--sae-tier` (each `easy`, `medium` or `hard`, Easy when left out) pick the AI tier of one side, so a run can
pit Medium against Easy. A run that uses either option adds a line under the results by side with the tiers and how
many Escalation crises each side caused (a crisis is Escalation reaching 6; the side that caused it draws the cost),
and how many tech race attempts each side made (the public `techRaceAttempted` events; zero while the AI never picks
the action). Without them the report is exactly as before.

```
node tools/balance/run.mjs --scenario test-map --games 200 --lio-tier medium --sae-tier easy
```

## How to run it

```
node tools/balance/run.mjs                      # 200 games, base seed "balance"
node tools/balance/run.mjs --games 50 --seed x  # 50 games from base seed "x"
node tools/balance/run.mjs --json               # the same numbers as JSON
```

`--games` must be a positive whole number. The same arguments always print the same report: game `i` (counting
from 0) uses the match seed `<base>-<i>`, and the two Easy players use seeds `2i` (LIO) and `2i+1` (SAE).

Each game runs through the match host exactly as a real match would: each player sees only its own screen
(its view and its waiting decision). When both sides must answer at once, LIO answers first. The map numbers come
from the spectator's screen (the public view and public events), never from the game state. If a player throws or
gives no answer to a decision, the run stops with that game's number, match seed and the decision, instead of
hanging.

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

- **Map, per side** (only on a scenario with a map, such as `test-map`; left out otherwise, in the text and in the
  JSON's `map`): for LIO and SAE, averages per game of
  - **influence**: its influence on the whole map when the game ended;
  - **countries controlled**: how many countries it controlled when the game ended (the engine's own control rule);
  - **place points**, **intervene points**, **realign points**: the points it spent on each action of the menu. These
    are read from the game's public events: each influence placed counts its cost (1, or 2 where the rival had
    control), an intervention counts the points put into it, and each realignment attempt counts 1. Points a side
    could not use (or chose not to, by passing or stopping a realignment early) count nowhere.

- **Era ends, per side** (only on a scenario with a map; the JSON's `eraEnds`): one row per era and side, taken when
  the next era starts and when the game ends, with the battleground list of the era that is ending. Averages per
  game, over the games that reached that era's end, of
  - **countries** and **battlegrounds**: how many it controlled on the whole map;
  - **regions present**, **regions ahead**, **regions every BG**: in how many regions it reached that level, by the
    scoring rules' definitions (docs/design/map-and-points.md, "Scoring"). A side counts only its highest level in
    each region; in a region with no battlegrounds that era, ahead counts countries only.
    This section is control only: the amounts and the score are in the Score section below.
- **Score** (only on a map with scoring, which `--numbers` can give; the JSON's `score`): the real engine scores
  every region at each era's end, so this section reports what that did over the games:
  - **Score track**: the start, and where the track ended (average, lowest, highest; positive favours SAE);
  - **how the game ended**: a side reached its track end, the side ahead after the last era won, or an even track
    (counted as a draw here: the tech-race tie-break cannot be measured yet), with each side's wins;
  - **Score per era** and **Score per region**: the points each side got on average and the net swing (SAE minus
    LIO), over the games that scored it; the region table also counts the games the region **decided** (it pushed
    the track over its end, or moved it most towards the winner) and their share.
    A crisis does not move the score in these runs. The tool reads only public frames, as the app does.

Averages are rounded to 2 decimal places and shares to 3. These numbers come from Easy AI games of a TEST
scenario with no victory rule, so they show how the cards flow through a game, not whether the design is good.

## Other turn counts, plays per turn and era arrival turns

These options change only this run's games, on any scenario. No scenario file, card, or game rule changes, and
the hand size stays the scenario's (8 on first-deck, 2 on test-map, where the host therefore refuses `--plays 2`).
The era ids are the chosen scenario's: on `test-map`, which has only era-1, every `--era` is refused.

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

## Trying other map numbers

```
node tools/balance/run.mjs --scenario six-region --numbers docs/proposals/map-numbers/option-a-history.json
```

`--numbers <file>` lays a JSON file's numbers over the chosen map scenario for this run only; the scenario file does
not change. It needs a scenario with a map (`test-map` or `six-region`). Every part of the file is optional:

```json
{
  "name": "shown in the report's first line",
  "stability": { "taiwan": 3 },
  "battlegrounds": { "era-1": ["ukraine", "taiwan"] },
  "startingInfluence": [{ "country": "taiwan", "lio": 3, "sae": 0 }],
  "scoring": {
    "track": { "end": 15, "start": 0 },
    "regions": [{ "region": "europe", "present": 2, "ahead": 4, "all": 6 }]
  }
}
```

- `stability`: the named countries take these stabilities (whole numbers, 1 or more); the others keep theirs.
- `battlegrounds`: the named eras take these lists (each country once); the others keep theirs. Only eras the map
  has a list for can be named.
- `startingInfluence`: replaces the map's whole starting influence list (whole numbers, 0 or more, each country once).
- `scoring`: the map's whole scoring (replaces any it has): `track.end` (whole number, 1 or more), `track.start`
  (a whole number inside the track; negative leans to LIO, whose end is `-end`) and one entry for every region of
  the map, once each, with `present`, `ahead` and `all` amounts (whole numbers, 0 or more). Regions score in the
  map's own order. The report then gains the Score section.
- A file that cannot be read, is not JSON, has another key or names an unknown country is refused with the reason,
  and no game is played.

## The AI arena

`node tools/balance/arena.mjs [--a <tier>] [--b <tier>] [--games <n>] [--seed <base>] [--scenario <name>] [--json]`
plays n seeded games of tier A against tier B (Medium against Easy, 100 games on the six-region map, by default)
through the match host, with the two tiers swapping sides every game. It prints each tier's win rate, each side's win
rate, each tier's wins by the side it played, draws and the average game length. It checks the Decision 8 gate for the
pairing: Medium beats Easy in over 75% of games, Hard beats Medium in over 65% (draws count against), and exits 1 when
it fails. 100 Medium-vs-Easy games take about 7 seconds; 200 Hard-vs-Medium games take about 21 minutes.
