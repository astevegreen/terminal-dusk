# The map, influence, points and tension: owner decisions (W7)

Decided by the owner on 20 October 2026, in answer to the W7 proposal pack (`docs/proposals/w7/`, pull request
151). Where the owner said "apply the same rules as the reference game", this file spells the rules out in this
game's own words. The reference game is named by the owner only as the model for topic 3; none of its names, art or
text are used here.

Not yet built. Numbers marked "open" are for the owner to set. Scoring is not decided (last section).

## Map (proposal topic 1)

- **Six regions.** One map for the whole game, 1991 to 2025. It does not change between eras.
- **Home box.** Russia and China are drawn on the map with their own borders, and both belong to the SAE home box.
  The United States is the LIO home box. Countries next to a home box count as next to that side's influence.
- **Hong Kong** is part of China.
- **Taiwan** starts LIO-aligned.
- **Crimea** starts as the history of 1991 says. It is expected to turn SAE in most games.
- Country counts, region contents, adjacency lists, stabilities and battlegrounds: open (scenario data).

## Influence (proposal topic 2, option A)

- A side **controls** a country when its influence there is at least the country's stability **and** at least the
  rival's influence plus the stability.
- **Placing:** 1 point places 1 influence in a country where the side already has influence, or next to one, or
  next to its home box. Placing in a country the rival controls costs 2 points per influence.
- **Removing:** only through coups, realignments and card events.
- Influence is a whole number of 0 or more. Every removal stops at 0.

## Points and actions (proposal topic 3, "same rules as the reference game")

What the reference rules mean for this game, as far as they reach:

1. **A card played for its action points** gives its Ops number as points to spend on **one** action, all on that
   one action. This is the existing "play for points" choice. Ops modifiers (`opsValue`) apply.
2. **The action menu** is the proposal's option M1: **place influence**, **coup**, **realign**.
   - **Place influence:** as in the Influence section.
   - **Coup:** choose a country where the rival has influence. The acting side draws one card from its
     Contingency deck (1 to 6; no dice). Result = draw + points spent - 2 x the country's stability. If the result is
     above 0, remove that much rival influence (stopping at 0) and, for what is left over, add the same amount of the
     acting side's own influence. A coup in a battleground raises tension (see below). A coup does not need
     adjacency.
   - **Realign:** choose a country where the rival has influence. Each side draws one Contingency card. The acting
     side adds 1 for each adjacent country it controls and 1 if it has more influence in the target; the rival adds
     the same by the same tests. Higher total wins, and the difference removes that much of the loser's influence
     (stopping at 0). A tie changes nothing. A realignment does not need adjacency.
3. **A fourth action** takes the place of the reference game's extra track action. **Open:** which action (the
   proposal names Sanctions, Cyber operation and Information campaign). Until the owner names it, the menu is
   place, coup, realign.
4. **Rival cards and neutral cards** keep the rules already in `core-loop.md` ("Playing a card"): a rival card
   played for points still runs its event, before or after, at the player's choice; a neutral card played for
   points has no event.

### What this does not settle (owner to decide)

- **Event points.** A design line such as "LIO 2" is an event award. The reference rules have no matching
  mechanic: its card events score victory points or change the board directly, and only Ops buy actions. So
  proposal Part 1 (what "LIO 2" stands for: actions, a score track, or each side's standing) is **not** settled by
  "same rules". Owner questions 7, 19, 28, 44, 45 and 46 still wait on it.
- **The coup formula** above is the reference formula restated; confirm it is what you want, since proposal
  question 5 called the formula only an example.

## Tension (proposal topic 4, option B)

- One shared track from 0 to 6, starting at 2. A whole number that stops at its ends.
- **Rises** by 1 for each coup in a battleground (coups elsewhere do not move it) and through card events.
  **Falls** by 1 at each era's start as well as through events.
- **At 6** a crisis: the side that pushed it there loses score equal to a scenario number, the track drops back to
  3, and play goes on. **This needs a score track.** Open until scoring is decided.
- Which cards raise or lower it, and whether the arms-control cards are redesigned to move it: open.

## Scoring (proposal topic 5)

Not decided. The owner will consider it further. Depends on the event-points question above.

## Owner's remaining questions

1. What does an event's "LIO 2" stand for (proposal topic 3, Part 1)?
2. Which fourth action replaces the extra track action?
3. Scoring, as above.
4. Country and region content for the six-region map.
