Proposal, not a rule

# W7: the map, influence, points, the tension track and scoring

This proposal lays out options for the open design point W7 in `docs/design/cards/deck-plan.md` ("Engine wish
list"): the map, influence, the tension track and scoring. It decides nothing and recommends nothing. Every option
is a candidate for the owner to accept, change or throw away. Until the owner decides, the rules stay as they are
in `docs/design/`.

To stay under about 350 lines a file, the proposal is split into one file per topic:

| Topic                                                                  | File                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| 1. The map: regions, how many countries, adjacency                     | [1-map.md](1-map.md)                               |
| 2. Influence: placing it and controlling a country                     | [2-influence.md](2-influence.md)                   |
| 3. What points are spent on, and what a card's points award stands for | [3-points-and-actions.md](3-points-and-actions.md) |
| 4. The tension track                                                   | [4-tension.md](4-tension.md)                       |
| 5. Scoring: when it happens and how a game is won                      | [5-scoring.md](5-scoring.md)                       |

## What every option must fit (already settled)

Each option in the topic files was written to fit these, and says so where it matters:

- **Countries have stability and battlegrounds** (docs/architecture.md, Decision 4, "Map"). The map's topology
  (countries, regions, adjacency, stability, battlegrounds) is rules data; the artwork is separate.
- **Scenarios hold the map, the starting setup and the victory conditions**, picked from a fixed menu (Decision 4,
  "Scenarios"). So every number below (country count, track length, thresholds) would be scenario data, not code.
- **The map is phone-first** (Decision 6): zoomed out, each country is a badge showing net influence in its
  controller's colour; zoomed into a region, countries open into boxes with stability and both sides' influence
  numbers. The target screen is 844 x 390 landscape.
- **All values are integers** (Decision 1). No halves, no percentages in the rules.
- **Influence is never negative and every track stays in range** (Guardrails, fuzz invariant 2). Any "remove"
  stops at 0, and any track move stops at its ends.
- **No dice.** Anything random (a coup's result, for example) draws from the acting side's Contingency deck,
  whose cards are fixed at 1 to 6 for every scenario (owner question 24; docs/design/contingency-deck.md).
- **Two sides, LIO and SAE**, the same core rules for both, one special ability each (docs/design/sides.md;
  special abilities are proposal X3, not this one).
- **The base game runs 1991 to 2025 in three eras and always stops at 2025** (docs/design/eras.md). How many
  turns each era lasts is proposal X4, not this one.

## How the topics depend on each other

- Topic 3 (what points stand for) is the hinge. Owner questions 7, 19, 28, 44, 45 and 46 were all deferred to
  "when points have a designed use"; whichever option is picked there decides how every one of the 91 cards'
  rules texts is reworded in one pass (owner question 7).
- Topic 5 (scoring) needs topic 2 (what control means) and topic 3 (whether there is a score track at all).
- Topic 4 (tension) mostly matters if topic 3's action menu includes coups or another aggressive action.

The topic options are not numbered across files on purpose: a choice of "map option B" does not force any option
in another topic, except where a topic file says so.

## How cards are named here

Cards are named by their titles in `docs/design/cards/era-1.md`, `era-2.md` and `era-3.md`. No card's design line
mentions countries, influence, tension or a score track today: they speak only of "LIO 2", "SAE 1 at turn end",
"-1 Ops this turn" and tags. So "helps" below means "the card's design line and history would read naturally under
this option", and "strains" means "the card would need a design change, or reads oddly". No card changes as part of
this proposal.

## Questions for the owner

Each topic file ends with its own questions. These cut across topics:

1. Which topic should be settled first? Topic 3 (what a card's points award stands for) unblocks owner questions
   7, 19, 28, 44, 45 and 46; topic 1 (the map) unblocks the most engine work.
2. Should the base game have a map at all from the first playable version, or should a first version score
   points without a map (topic 3, option B) and add the map later?
3. When the choices are made, should the one-pass rewording of every card's rules text (owner question 7) happen
   in the same pull request as the rules, or as a separate pass per era?
4. Are any of the numbers in these files (country counts, track lengths, thresholds) ones you already have in
   mind? They are placeholders chosen only to make the trade-offs concrete.
