# Core loop

Promoted on 2026-10-16 from the Decided section of the Notion page "Core loop", plus seven answers the owner
gave that day. From now on this file is the source of truth; change it in Notion and promote again.

## A turn

1. **Opening cards.** At the start of each turn, both players pick one card from their hand at the same time,
   in secret. Neither player sees the other's pick until both have picked.
2. **Reveal.** Both opening cards are revealed together.
3. **Order.** The opening card with more action points resolves first. If both have the same action points,
   LIO's card resolves first.
4. **Opening cards are events only.** Each opening card resolves as its event. Its action points are not spent.
5. **Card plays.** After the opening cards, the players take turns playing one card at a time.
   LIO plays first in every turn.

## Playing a card

- Each played card is used in exactly one way: for its **event** or for its **action points**.
- Your own cards and neutral cards may be played either way.
- A **rival's card** (one whose side is the other player's) may only be played for its action points.
  Its event then still happens, as the rival's event:
  - the player who played the card chooses whether the event happens **before or after** they spend the points;
  - the **rival** makes every choice inside that event.
- **The new action.** One new kind of action sits alongside the familiar ones. Which one is not decided yet.

## Undo

- While a player is building an answer (for example placing several points of influence), they can undo freely.
- Once they confirm the answer, it cannot be undone.

## For the engine

- The opening picks are one simultaneous decision group (docs/architecture.md, Decision 1). A side's pick is
  held in its own private compartment ("own unrevealed picks", Decision 2), so the other side and spectators
  can't see it until both are in.
- Undo happens only in the UI's staged answer. The engine only ever sees confirmed answers.
- Hand size, cards played per turn and turns per era are not decided. They come from scenario data
  (docs/architecture.md, Decision 4), so the engine must not hard-code them. "Plays per turn" counts the plays
  **each side** makes (owner, 16 Oct).
- Until neutral events are designed, a neutral card can only be played for its action points and can't be an
  opening pick (owner, 16 Oct). This is a stopgap, not a rule of the game.

## Not decided yet

- Which new action joins the loop, and the full list of actions and their costs.
- Hand size, how many cards each player plays per turn, and how a turn ends.
- Who resolves a neutral card's event, and how scoring cards are played.
- The tension track and scoring (their own topic pages).
