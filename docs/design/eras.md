# Eras

Promoted on 2026-10-16 from the Decided section of the Notion page "Eras", plus one answer the owner gave that
day. Promoted again on 2026-11-21 with the turns per era, the free player's game and the 2025–2027 scenario's
length (owner, in chat: "Take all recommendations", on docs/proposals/era-lengths.md). From now on this file is the
source of truth; change it in Notion and promote again.

## The base game

The base game runs from 1991 to 2025 in three eras, and always stops at 2025.

| Era   | Years     | Starts at           | Turns | Its turns of the game |
| ----- | --------- | ------------------- | ----- | --------------------- |
| Era 1 | 1991–2001 | The Soviet collapse | 3     | 1–3                   |
| Era 2 | 2001–2008 | September 11, 2001  | 2     | 4–5                   |
| Era 3 | 2008–2025 | The financial crash | 5     | 6–10                  |

- **Turns follow the years** (owner, 21 Nov 2026: option A of docs/proposals/era-lengths.md). Each turn covers about
  3.4 years of history in every era. The base game is **10 turns**: Era 2's cards enter on turn 4 and Era 3's on
  turn 6, and the eras score at the end of turns 3, 5 and 10 (docs/design/map-and-points.md, "Scoring").
- Each side makes 2 plays per turn (docs/design/core-loop.md, "A turn").
- **Late eras are used less, as intended for now** (owner, 21 Nov 2026: "intended (for now)"). A new era's cards
  only join the draw pile, so a game uses fewer of a late era's cards than of Era 1's: with 2 plays per turn, about
  0.90 of Era 1's cards, 0.67 of Era 2's and 0.55 of Era 3's (era-lengths.md, run A2, counted before the five LIO
  cards of deck-plan.md question 52 were added).

## When a new era starts

- The new era's cards are shuffled into the **draw pile**: the cards not yet drawn.
- The discard pile is **not** part of that shuffle and stays where it is.

## Optional scenario: 2025–2027

- An optional scenario extends Era 3 with the most recent years and the "future" cards.
- Future cards name roles, not people.
- **It adds one turn after 2025** (owner, 21 Nov 2026: era-lengths.md question 4, A): **11 turns**, and the future
  cards enter on turn 11. Two years is about one 3.4-year turn.
- **Its final scoring and win check come at the end of 2027**, the end of turn 11 (owner, 21 Nov 2026: option B;
  docs/design/map-and-points.md, "Scoring").
- **Era 3 scores only once, at the end of 2027**, not also at the end of 2025 (owner, 21 Nov 2026, in chat). The
  future cards entering on turn 11 do not make turn 10 an era's end.

## The free player's game

- A free player plays **Era 1** against the AI (owner, 21 Nov 2026; docs/architecture.md, "Product calls": "the
  first era against the AI").
- It is as long as Era 1 in the base game: **3 turns** (owner, 21 Nov 2026: era-lengths.md question 3, A), with
  Era 1's cards only. Turn counts are scenario data, so it is its own scenario with that length.

## For the engine

- Which era's cards are in the game, and when each era enters, is scenario data (docs/architecture.md,
  Decision 4).
- The era shuffle uses the game's seeded random-number generator, like every other shuffle.

## Not decided yet

- Era names (neutral names, none taken from other games). The owner will supply them (21 Nov 2026).

Decided on 21 Nov 2026 (owner, in chat: "Take all recommendations"): how many turns each era lasts (3 / 2 / 5),
which era a free player can play against the AI (Era 1, 3 turns), and that the 2025–2027 scenario scores Era 3
only once, at the end of 2027.
