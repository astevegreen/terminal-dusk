# Core loop

Promoted on 2026-10-16 from the Decided section of the Notion page "Core loop", plus seven answers the owner
gave that day. Promoted again the same day with four calls from the engine spec review, and on 2026-10-19 with
the refill rule (owner, deck plan Owner questions 5 and 27). From now on this file is the source of truth;
change it in Notion and promote again.

## A turn

1. **Refill.** At the start of each turn, both players refill their hands to the hand size (see "Refilling
   hands" below).
2. **Opening cards.** Then both players pick one card from their hand at the same time, in secret. Neither
   player sees the other's pick until both have picked. A player may pick one of their rival's cards.
3. **Reveal.** Both opening cards are revealed together.
4. **Order.** The opening card with more action points resolves first. If both have the same action points,
   the card LIO picked resolves first, whichever side's card it is.
5. **Opening cards are events only.** Each opening card resolves as its event. Its action points are not spent.
   A rival's card picked as an opening card resolves as the rival's event, exactly as if the rival had played it,
   except that its Contingency draws from the rival's own deck come from the World deck
   (docs/design/contingency-deck.md).
6. **Card plays.** After the opening cards, the players take turns playing one card at a time.
   LIO plays first in every turn.

## Refilling hands

- At the start of each turn, both sides refill their hands to the **hand size** (8 for now) from **one shared
  draw pile**. The draw pile holds any side's cards and neutral cards. Cards still in a hand stay there and
  count toward the hand size.
- **When.** If a new era starts on this turn, its cards are shuffled into the draw pile first
  (docs/design/eras.md). Then the hands refill. Then the opening picks are made.
- **The first hand.** There is no separate deal. The first era's cards start in the shuffled draw pile, and the
  refill at the start of turn 1 deals each side its first hand.
- **When the draw pile runs out** while a side still needs cards, the discard pile is shuffled to become the new
  draw pile, and drawing goes on from it.
- **Running out of both cannot happen.** At the start of a turn every card in the game is in a hand, the draw
  pile or the discard pile: no card is in play then, and no card leaves the game yet. So if the first era has
  at least twice the hand size in cards, both hands always fill. A scenario with fewer is refused. This must be
  looked at again if cards that leave the game are added.
- **Who sees what.** Each side sees the cards it draws. The rival sees only how many cards were drawn, as it
  already sees how many cards each hand holds.

## Playing a card

- Each played card is used in exactly one way: for its **event** or for its **action points**.
- Your own cards and neutral cards may be played either way.
- A **rival's card** (one whose side is the other player's) may only be played for its action points.
  Its event then still happens, as the rival's event:
  - the player who played the card chooses whether the event happens **before or after** they spend the points;
  - the event runs exactly as if the **rival** had played it, except that its Contingency draws from the
    rival's own deck come from the World deck (docs/design/contingency-deck.md).
- **Who answers a choice in an event.** Each choice goes to the side the card names, for opening cards and
  card plays alike. A card names LIO or SAE, never "the player who played this card", so who played a card
  never changes who answers. Example: SAE plays an LIO card whose event says "SAE chooses a country"; SAE chooses.
- **Neutral events.** A neutral card's event works like any other card's: each choice goes to the side the card
  names (LIO, SAE or both). A neutral card can be an opening pick; it then resolves as its event, like any
  opening card. A neutral card played for its action points has no event (owner, 18 Oct, decision 17 option c).
  For whose Contingency deck a neutral event draws from, see docs/design/contingency-deck.md.
- **The new action.** One new kind of action sits alongside the familiar ones. Which one is not decided yet.

## Undo

- While a player is building an answer (for example placing several points of influence), they can undo freely.
- Once they confirm the answer, it cannot be undone.

## For the engine

- The opening picks are one simultaneous decision group (docs/architecture.md, Decision 1). A side's pick is
  held in its own private compartment ("own unrevealed picks", Decision 2), so the other side and spectators
  can't see it until both are in.
- Undo happens only in the UI's staged answer. The engine only ever sees confirmed answers.
- Hand size, cards played per turn and turns per era come from scenario data (docs/architecture.md,
  Decision 4), so the engine must not hard-code them. The hand size is 8 for now; plays per turn and turns per
  era are not decided. "Plays per turn" counts the plays **each side** makes (owner, 16 Oct).
- A refill draws LIO's cards first, then SAE's. The draw pile is shuffled with the game's seeded generator, so
  this order changes which cards each side gets but not the chances.
- The engine refuses a scenario whose hand size is smaller than 1 + plays per turn (a side could not make all its
  plays), or whose first era has fewer cards than twice the hand size (see "Refilling hands").
- The 16 Oct stopgap (a neutral card only for its action points, never an opening pick) is lifted by the
  neutral events rule above (owner, 18 Oct). Neutral cards in card data now carry events like other cards.
- In card data, the side that answers a choice is LIO, SAE or both. There is no value meaning "whoever played
  the card" (owner, 16 Oct).

## Not decided yet

- Which new action joins the loop, and the full list of actions and their costs.
- How many cards each player plays per turn, and how a turn ends.
- How scoring cards are played.
- The tension track and scoring (their own topic pages).
