# Contingency deck

Promoted on 2026-10-17 from the Notion page "Outcome deck (replaces dice)": the choice to replace dice (owner,
16 Oct), and the owner's 17 Oct calls on the reshuffle, what players see, whose deck and the name. Two answers
the owner gave while promoting are marked "(owner, 17 Oct, promoting)". Promoted again on 2026-10-19 with the
owner's 19 Oct calls: reshuffle when two cards are left, the World deck, and realignments keeping their own
decks. From now on this file is the source of truth; change it in Notion and promote again.

## No dice

- The game has no dice. Each side has its own **Contingency deck** of numbered cards, and a third,
  shared **World deck** belongs to neither side (below).
- Wherever a die roll would decide a result, the player draws the top card of a Contingency deck instead.
  The number on that card is the result.
- **Why:** luck should even out over a game, so the winner is decided by play, not by a run of bad rolls.

## The deck

- By default each deck, the World deck included, has six cards, numbered 1 to 6, one of each.
- A scenario may give the decks different cards. The default applies unless the scenario says otherwise
  (owner, 17 Oct, promoting).
- Every deck holds at least three cards. A deck of two would never reach "two cards left" after a draw, so it
  would never reshuffle (owner, 19 Oct). A scenario with a smaller deck is refused.
- At the start of the game, each deck is shuffled separately.

## Drawing

- A draw takes the top card of the deck. Its number is the result, and the card is set aside until the deck is
  rebuilt.
- Modifiers and thresholds treat the number exactly like a die result. For example, "+1 to the result" adds 1
  to the number drawn.
- **Whose deck:**
  - an action a side takes (a coup, for example) draws from that side's deck;
  - when both sides draw at once (the Notion page gives a realignment as an example), each side draws one card
    from its own deck. In a realignment this includes the defender (owner, 19 Oct; see "Realignments" below);
  - an event draws from the deck of the side the event belongs to, unless its text names the rival's deck
    (below). A rival's card played by a side, as its opening pick or for its action points, runs as the
    rival's event (docs/design/core-loop.md), but its draws from the rival's own deck come from the World
    deck (below).
  - a neutral event draws from the deck of the side that played the card (for an opening pick, the side
    that picked it). This holds for every draw in the event, whichever side answers its choices. Example:
    LIO plays a neutral card whose event says "SAE chooses, then draw a contingency"; the draw comes from
    LIO's deck (owner, 18 Oct, decision 17 option c).
  - **Drawing from the rival's deck** (owner, 19 Oct, answering Owner question 2 of the first-deck plan,
    PR #121). Any LIO or SAE card's event may draw from the rival's deck instead of
    its own, when its text names that deck. One card may draw from both decks, for example "each side
    draws; the higher number wins". The card names the deck; who played the card never changes it, except
    that a rival's card draws from the World deck instead of its owner's deck (below). So when
    SAE plays an LIO card for its action points and the LIO event draws from SAE's deck, SAE's own deck is
    drawn.
  - Such a draw is an ordinary draw from that deck: the card is used up and set aside, it counts toward
    that deck's reshuffle exactly like its owner's own draws, and players see it like any other draw
    (below). A neutral card drawing from the deck of the side that did not play it is not part of this rule.

## The World deck

Owner, 19 Oct.

- **When it is used:** whenever a side plays the rival's card, either as its opening pick or for its action
  points. The rival's event still runs, but every draw it would take from the rival's own deck comes from the
  World deck instead.
- **Draws the card sends to the player's deck stay there.** If the event's text draws from the deck of the side
  that played the card (the rival's-deck rule above), that draw still comes from that deck. Example: SAE plays
  an LIO card for its action points, and the card says "each side draws; the higher number wins". LIO's draw
  comes from the World deck, SAE's from SAE's own deck.
- **Nothing else uses it.** A side's own actions, its own cards played for their events, neutral events and
  realignments draw as described above.
- A World deck draw is an ordinary draw: the card is used up and set aside, the World deck reshuffles by the
  same rule as the side decks, and players see it like any other draw.
- **Why:** otherwise the side playing the rival's card could use the rival's event to burn the rival's cards.
  Burning a random card does not change the odds of the rival's next draw (the order is hidden). It pays when
  the rival's deck has three good cards left: one more draw then forces a reshuffle and throws the good cards
  away. Playing a rival's card for its action points made this cheap, because the player also gets the points.
- **What it doesn't stop:** the World deck is public too, so a side can wait to play a rival's card until the
  World deck has only low cards left. That spoils only that one event, not the rival's own later draws.

## Realignments

- In a realignment each side draws from its own deck, the defender included (owner, 19 Oct).
- **Why:** the defender's card is drawn in the same contest. An attacker who realigns to burn a good defender
  deck will probably see the defender draw high and win, so the attacker pays at once. Timing a realignment by
  reading the rival's deck is part of the skill the decks add.
- Not picked: the defender drawing from the World deck (the defender's luck would no longer even out, and
  reading the rival's deck would stop mattering), or both sides drawing from the World deck (realignments
  would become plain luck).

## Reshuffle

- As soon as a draw leaves exactly two cards in a deck, all of that deck's cards, including the two left, are
  shuffled back together into a full deck. This happens straight after the draw, before anything else
  (owner, 19 Oct; was one card left, 17 Oct).
- So in each cycle a deck gives all but two of its cards, and every draw is from at least three cards.
- **Trade-off** (Notion numbers: one side, 15 draws a game). 50/50 draws whose result is known before the
  draw fall from 10% to about 2%. Luck evens out less: a whole game averaging 3 or less rises from 0.5% to
  5.6% (dice: 15%).
- Only the reshuffle rebuilds a deck. Decks carry over between turns and between eras.

## What players see

- Both players, and spectators, can see which numbers are left in each deck, the World deck included. Only
  the order is hidden.
- Suggested display: one die face per card for each deck, with the used ones greyed out.

## Card text

- Card text uses a draw from the Contingency deck wherever a die roll would be used.
- The exact wording (for example "draw a contingency") is not decided yet. Card writers use a placeholder until
  it is.

## For the engine

- Each deck's order lives in the **secret** compartment (docs/architecture.md, Decision 2). Which numbers are
  left in each deck is **public**. Both are plain lists of integers. The World deck is stored the same way
  and belongs to no side.
- Decks are shuffled with the game's seeded shuffle, so replays and the seed reveal verify every draw.
- The deck contents (default 1 to 6) come from scenario data (Decision 4); the engine must not hard-code them.
- The atomic step is "draw contingency" and the hook point is "coup result" (Decision 4). There is no dice
  code in the engine to rework.
- The AI reads which numbers are left in each deck from its view, like any other public information.

## Not decided yet

- The exact card wording for a draw. A draw from the rival's deck uses a placeholder too, such as
  "draw a contingency from SAE's deck".
- Once modifiers can change a drawn number: when a side's card draws from the rival's deck, whether that
  side's bonuses apply (it is that side's event) or the deck owner's (owner, 19 Oct: decide later). The same
  question applies to a World deck draw.
- Backup idea from the Notion page, not adopted: if playtests show single misses still sting, a bad-luck token (each 1 drawn earns
  one, hold at most 2, spend one for +1 on a later draw).
