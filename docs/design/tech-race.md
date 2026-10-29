# The tech race track: owner decisions (T1)

Decided by the owner on 28 October 2026 in a brainstorming session, starting from option T1 of
`docs/proposals/tech-race.md` (one shared marker) and reshaping it. The owner asked for a track that plays like the
reference game's extra track "but with its own flavor and thematically appropriate"; none of that game's names, art
or text are used here. This file is the source of truth for the tech race; `map-and-points.md` and `core-loop.md`
point here.

Not yet built. Every number is a placeholder that the balance pass may tune, as for the map's stabilities.

## The track

- **One shared marker** (owner: T1). It runs from SAE's end through **parity** to LIO's end: 4 steps each way
  (owner: "4 each way"), 9 spaces, stored as one whole number from -4 to 4. Public state. The base game starts at
  parity, and the marker never resets: it carries over from era to era (owner: "All five, as listed").
- **The steps are named technologies** (owner: "Named steps"; "Make it networking/orbit - AI - hypersonics -
  quantum computing"). The names are the same for both sides:

  | Lead | Step               | Cost |
  | ---- | ------------------ | ---- |
  | 1    | Networks and Orbit | 1    |
  | 2    | AI                 | 2    |
  | 3    | Hypersonics        | 3    |
  | 4    | Quantum Computing  | 4    |

- **The side the marker favours "holds" its step and every step below it.** The other side holds nothing until it
  pulls the marker back past parity. The two sides can never hold the same step.

## Making an attempt

The tech race is the fourth action on the menu (`map-and-points.md`, "Points and actions", point 3).

- **Cost.** Steps cost more the further they are from parity (owner: "Progressively more points as bonuses become
  more powerful further down the track"; "1, 2, 3, 4"). Moving the marker **away from parity** to a side's next
  step needs that step's cost. **Pulling the rival's lead back** one step needs what the rival's current step cost
  (owner: "Same as it cost"): from Quantum Computing back to Hypersonics costs 4, from Networks and Orbit back to
  parity costs 1. The cost is the same for both sides.
- **One step per attempt, and a draw** (owner: "Draw 4+ to succeed"). The card played for its points must carry
  at least the cost; all of a play's points go to one action, so any points above the cost are lost. The side then
  draws one card from its own Contingency deck. On 4 or more the marker moves one step; on 3 or less it stays. The
  draw is an ordinary draw (`contingency-deck.md`): used up, counted toward the reshuffle, and seen by both sides.
- **Once per turn** (owner: "No event, once a turn"). Each side may choose the tech race at most once in a turn,
  whatever the attempt's result. So the marker moves at most one step per side per turn.
- **A rival's card spent on the tech race has no event** (owner: "No event, once a turn"). This is the one
  exception to the rule that a rival's card played for its points still runs its event (`core-loop.md`, "Playing
  a card"). A failed attempt still spends the card and still cancels the event. Because the event does not happen,
  a card that leaves the game when its event happens stays in the game.
- **Only a card played for its points can make an attempt** (owner: "No, cards only"). Event points (a design line
  such as "LIO 2") may not be spent on the tech race.
- **At its own end.** A side holding Quantum Computing cannot choose the tech race to move further: there is
  nothing to buy. The rival can still pull the marker back, so the action never closes for both sides.
- **Always open.** Escalation's thresholds never close the tech race; like placing influence, it can always be
  chosen (owner: "All five, as listed").

## What each step gives

Powers add up: the side holding a step has its power and every power below it (owner: "Recommended fit").

| Step                  | Power while held                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Networks and Orbit | +1 to the side's total in each realignment it starts                                                                                         |
| 2. AI                 | +1 to the result of each of the side's interventions                                                                                         |
| 3. Hypersonics        | one extra card play at the end of each turn (below); **entering** it raises Escalation by 1                                                  |
| 4. Quantum Computing  | the rival must pick its opening card first, and this side sees it before picking its own; at each era's end, the score track moves 1 its way |

- **The extra play** (owner: "Optional full play"). After both sides have made all their normal card plays for the
  turn, a side holding Hypersonics may play one more card from its hand. It is optional, and it is an ordinary
  play: for the event or for points, on any action. A tech race attempt is allowed in it only if the side has not
  already made its one attempt that turn. The turn-end rules come after it.
- **Hypersonics and Escalation** (owner: "Only advancing"). Only gaining Hypersonics raises Escalation: the marker moving from AI to
  Hypersonics on a side's own attempt. A rival pulling the marker back from Quantum Computing to Hypersonics raises
  nothing. It happens every time the marker enters Hypersonics this way, not while it stays there.
- **A crisis from Hypersonics** (owner: "The side that advanced"). If entering Hypersonics pushes Escalation to 6,
  the side whose attempt moved the marker caused the crisis, even when the card it spent was the rival's.
- **The opening-card power.** At the start of a turn, the rival of the side holding Quantum Computing picks its
  opening card first; the Quantum Computing side sees it, then picks its own. Which opening
  card resolves first is unchanged (`core-loop.md`, "A turn", point 4).
- **The era score** (owner: "After the regions"). At each era's end, after all six regions have scored, the side
  holding Quantum Computing moves the score track 1 toward itself. If that reaches its end of the track, it wins
  at once, as with any score.

## First there

- **The first side in the game to reach each step gets +1 on its next tech race draw** (owner: "Getting somewhere
  first gives that player a +1 to their "roll" on their next tech track attempt"; "Every step"). Each of the four
  steps gives this once per game, to whichever side reaches it first. Reaching it later, or again, gives nothing.
- The +1 is added to the side's very next attempt, whether that attempt pushes forward or pulls the rival back. It
  cannot be saved for later.

## Links to the rest of the game

- **Credibility.** Tech race attempts do not count toward Credibility, which stays about interventions (owner:
  "All five, as listed").
- **The tie-break** (`map-and-points.md`, Scoring, "An even track at the end"). "Further ahead on the tech race"
  means the side the marker favours. With the marker at parity, the game is a draw (owner: "All five, as listed").
- **Special abilities** (`docs/proposals/special-abilities.md`, not yet chosen). No power changes a rival card's
  points (L1, S2), redraws a Contingency card (L2), adds a placement (L3, S3) or primes a later play (S1). If LIO's
  ability is L2, the +1 bonuses stack with its redraw (owner: "All five, as listed"): the redraw replaces a drawn
  number before it is used, and the +1 is added afterwards.
- **Turn-end payments** still only place influence (`map-and-points.md`, "Event points"); they are event points,
  so they could not make an attempt anyway.

## Open

- The balance pass on the costs, the success number, the length of the track and the powers, once the Medium AI
  can play it.
- Whether the 2025-2027 scenario (`eras.md`) starts the marker somewhere other than parity.
- Cards that move the marker or name a step, in the card rewording pass (`map-and-points.md`, Escalation, "Cards
  that move it").
