# Eras

Promoted on 2026-10-16 from the Decided section of the Notion page "Eras", plus one answer the owner gave that
day. From now on this file is the source of truth; change it in Notion and promote again.

## The base game

The base game runs from 1991 to 2025 in three eras, and always stops at 2025.

| Era   | Years     | Starts at           |
| ----- | --------- | ------------------- |
| Era 1 | 1991–2001 | The Soviet collapse |
| Era 2 | 2001–2008 | September 11, 2001  |
| Era 3 | 2008–2025 | The financial crash |

## When a new era starts

- The new era's cards are shuffled into the **draw pile**: the cards not yet drawn.
- The discard pile is **not** part of that shuffle and stays where it is.

## Optional scenario: 2025–2027

- An optional scenario extends Era 3 with the most recent years and the "future" cards.
- Future cards name roles, not people.

## For the engine

- Which era's cards are in the game, and when each era enters, is scenario data (docs/architecture.md,
  Decision 4).
- The era shuffle uses the game's seeded random-number generator, like every other shuffle.

## Not decided yet

- Era names (neutral names, none taken from other games).
- How many turns each era lasts.
- Which era a free player can play against the AI ("the first era", per the product calls).
