# Contingency deck

Promoted on 2026-10-17 from the Notion page "Outcome deck (replaces dice)": the choice to replace dice (owner,
16 Oct), and the owner's 17 Oct calls on the reshuffle, what players see, whose deck and the name. Two answers
the owner gave while promoting are marked "(owner, 17 Oct, promoting)". From now on
this file is the source of truth; change it in Notion and promote again.

## No dice

- The game has no dice. Each side has its own **Contingency deck** of numbered cards.
- Wherever a die roll would decide a result, the player draws the top card of a Contingency deck instead.
  The number on that card is the result.
- **Why:** luck should even out over a game, so the winner is decided by play, not by a run of bad rolls.

## The deck

- By default each deck has six cards, numbered 1 to 6, one of each.
- A scenario may give the decks different cards. The default applies unless the scenario says otherwise
  (owner, 17 Oct, promoting).
- At the start of the game, each side's deck is shuffled separately.

## Drawing

- A draw takes the top card of the deck. Its number is the result, and the card is set aside until the deck is
  rebuilt.
- Modifiers and thresholds treat the number exactly like a die result. For example, "+1 to the result" adds 1
  to the number drawn.
- **Whose deck:**
  - an action a side takes (a coup, for example) draws from that side's deck;
  - when both sides draw at once (the Notion page gives a realignment as an example), each side draws one card
    from its own deck;
  - an event draws from the deck of the side the event belongs to. A rival's card played for its action
    points runs as the rival's event (docs/design/core-loop.md), so it draws from the rival's deck.
  - a neutral event draws from the deck of the side that played the card (for an opening pick, the side
    that picked it). This holds for every draw in the event, whichever side answers its choices. Example:
    LIO plays a neutral card whose event says "SAE chooses, then draw a contingency"; the draw comes from
    LIO's deck (owner, 18 Oct, decision 17 option c).
  - **Drawing from the rival's deck** (owner, 19 Oct, answering Owner question 2 in
    docs/design/cards/deck-plan.md). Any LIO or SAE card's event may draw from the rival's deck instead of
    its own, when its text names that deck. One card may draw from both decks, for example "each side
    draws; the higher number wins". The card names the deck; who played the card never changes it. So when
    SAE plays an LIO card for its action points and the LIO event draws from SAE's deck, SAE's own deck is
    drawn.
  - Such a draw is an ordinary draw from that deck: the card is used up and set aside, it counts toward
    that deck's reshuffle exactly like its owner's own draws, and players see it like any other draw
    (below). A neutral card drawing from the deck of the side that did not play it is not part of this rule.

## Reshuffle

- As soon as a draw leaves exactly one card in a deck, all of that deck's cards, including the one left, are
  shuffled back together into a full deck. This happens straight after the draw, before anything else
  (owner, 17 Oct, promoting).
- So in each cycle a side draws all but one of its cards, and a deck never shows a single card left.
- Only the reshuffle rebuilds a deck. Decks carry over between turns and between eras.

## What players see

- Both players, and spectators, can see which numbers are left in each deck. Only the order is hidden.
- Suggested display: one die face per card for each side, with the used ones greyed out.

## Card text

- Card text uses a draw from the Contingency deck wherever a die roll would be used.
- The exact wording (for example "draw a contingency") is not decided yet. Card writers use a placeholder until
  it is.

## For the engine

- Each deck's order lives in the **secret** compartment (docs/architecture.md, Decision 2). Which numbers are
  left in each deck is **public**. Both are plain lists of integers.
- Decks are shuffled with the game's seeded shuffle, so replays and the seed reveal verify every draw.
- The deck contents (default 1 to 6) come from scenario data (Decision 4); the engine must not hard-code them.
- The atomic step is "draw contingency" and the hook point is "coup result" (Decision 4). There is no dice
  code in the engine to rework.
- The AI reads which numbers are left in each deck from its view, like any other public information.

## Not decided yet

- The exact card wording for a draw. A draw from the rival's deck uses a placeholder too, such as
  "draw a contingency from SAE's deck".
- Once modifiers can change a drawn number: when a side's card draws from the rival's deck, whether that
  side's bonuses apply (it is that side's event) or the deck owner's (owner, 19 Oct: decide later).
- Backup idea from the Notion page, not adopted: if playtests show single misses still sting, a bad-luck token (each 1 drawn earns
  one, hold at most 2, spend one for +1 on a later draw).
