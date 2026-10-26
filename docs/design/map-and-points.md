# The map, influence, points and escalation: owner decisions (W7)

Decided by the owner on 20 October 2026, in answer to the W7 proposal pack (`docs/proposals/w7/`, pull request
151). Where the owner said "apply the same rules as the reference game", this file spells the rules out in this
game's own words. The reference game is named by the owner only as the model for topic 3; none of its names, art or
text are used here. Updated on 22 October 2026 with the owner's answers from the escalation design dialogue: the
Escalation section, the Intervene action (formerly the coup) and the fourth action.

Not yet built. Numbers marked "open" are for the owner to set. Scoring is not decided (last section).

## Map (proposal topic 1)

- **Six regions.** One map for the whole game, 1991 to 2025. It does not change between eras.
- **Home box.** Russia and China are both part of the SAE home box; the United States is the LIO home box. Home
  boxes are not countries for placing or control. Countries next to a home box count as next to that side's
  influence. Open: whether Russia's and China's borders are only artwork or also decide which countries touch
  the SAE box.
- **Hong Kong** is part of China.
- **Taiwan** starts LIO-aligned.
- **Crimea** starts as the history of 1991 says (owner).
- Country counts, region contents, adjacency lists, stabilities and battlegrounds: open (scenario data).

## Influence (proposal topic 2, option A)

- A side **controls** a country when its influence there is at least the country's stability **and** at least the
  rival's influence plus the stability.
- **Placing:** 1 point places 1 influence in a country where the side already has influence, or next to one, or
  next to its home box. Placing in a country the rival controls costs 2 points per influence.
- **Reach and leftovers when placing** (owner, 26 Oct, #315 option a): which countries a side may place in is
  fixed when the play starts, so influence placed earlier in the same play does not open up its neighbours. Every
  point must be spent while a legal placement is left; a side may not stop early.
- **Removing:** only through interventions, realignments and card events.
- Influence is a whole number of 0 or more. Every removal stops at 0.

## Points and actions (proposal topic 3, "same rules as the reference game")

What the reference rules mean for this game, as far as they reach:

1. **A card played for its action points** gives its Ops number as points to spend on the action menu. This is
   the existing "play for points" choice. All of a play's points go to one action; they cannot be split between
   actions (owner, 26 Oct, #316). Ops modifiers (`opsValue`) apply.
2. **The action menu** is the proposal's option M1: **place influence**, **intervene**, **realign**, plus the
   fourth action (point 3).
   - **Place influence:** as in the Influence section.
   - **Intervene** (the reference game's coup, renamed; owner, 22 Oct): choose a country where the rival has
     influence. The acting side draws one card from its Contingency deck (1 to 6; no dice). Result = draw + points
     spent - 2 x the country's stability. If the result is above 0, remove that much rival influence (stopping at 0)
     and, for what is left over, add the same amount of the acting side's own influence. An intervention in a
     battleground raises Escalation (see below). An intervention does not need adjacency. The formula is confirmed
     as written (owner, 26 Oct, #316 option a).
   - **Why the new name.** Coups still happened in 1991-2025, but they were no longer the main way great powers
     flipped a country. "Intervene" covers the period's ways: backed uprisings, armed interventions, contractors
     propping up juntas, grey-zone takeovers. The rule is unchanged; each card tells its own story.
   - **Realign:** choose a country where the rival has influence. Each side draws one Contingency card. The acting
     side adds 1 for each adjacent country it controls and 1 if it has more influence in the target; the rival adds
     the same by the same tests. Higher total wins, and the difference removes that much of the loser's influence
     (stopping at 0). A tie changes nothing. A realignment does not need adjacency. A side whose home box touches
     the target also adds 1. Each point buys one attempt, and each attempt may target a different country. The
     formula, cost and home-box bonus are confirmed (owner, 26 Oct, #317, "approved as recommended").
3. **The fourth action is the tech race** (owner, 22 Oct: "let's go with (a) The track is the fourth action"). It
   takes the place of the reference game's extra track action: a side spends a card's points to move up the tech
   race track. The track itself (its branches, costs and what moving up gives) is its own topic, not designed yet.
   Until it is, the menu is place, intervene, realign.
4. **Rival cards and neutral cards** keep the rules already in `core-loop.md` ("Playing a card"): a rival card
   played for points still runs its event, before or after, at the player's choice; a neutral card played for
   points has no event.

### Event points (proposal topic 3, Part 1, option A; owner, 20 Oct: "A")

- A design line such as "LIO 2" (the `spendPoints` step) means: that side **spends 2 points on the action menu**
  (place, intervene, realign), as if it had played an Ops 2 card for points. "Both get 1" means each side spends 1
  point, in turn. The side answers a pending Decision; the points are not stored anywhere.
- Owner questions 7, 19, 28, 44, 45 and 46 are no longer waiting on this topic. Their answers still need checking
  against real placements, and the rules text of every card is reworded in one pass (question 7).
- Open: how a turn-end payment ("pay again at turn end") is split when it is 1 point (placing only, or any action).
- Open (tech race topic): whether event points may also be spent on the tech race.

## Escalation (proposal topic 4, option B)

Called "tension" until the owner's 22 October dialogue, which settled everything below except the parts that wait
on scoring, the map and the tech race.

- **Name.** The track is called **Escalation** on screen (owner, 22 Oct), after Herman Kahn's escalation ladder
  (_On Escalation_, 1965).
- **Track.** One shared track from 0 to 6, starting at 2. A whole number that stops at its ends. Public state.
- **Levels** (owner, 22 Oct). The calm levels take their names from Michael Lund's curve of conflict (1996), the
  tense ones from Kahn's ladder, and "Brink" from Thomas Schelling's brinkmanship. Levels 3, 4 and 5 are the
  **thresholds**:

  | Level | Name           | Closed to interventions and realignments |
  | ----- | -------------- | ---------------------------------------- |
  | 0     | Durable Peace  | none                                     |
  | 1     | Stable Peace   | none                                     |
  | 2     | Unstable Peace | none (the starting level)                |
  | 3     | Confrontation  | one region                               |
  | 4     | Show of Force  | two regions                              |
  | 5     | Brink          | three regions                            |
  | 6     | Crisis         | a crisis happens (below)                 |

- **Rises** by 1 for each intervention in a battleground (owner, 22 Oct: interventions elsewhere do not raise it)
  and through card events (below).
- **Falls** by 1 at the end of each turn (owner, 22 Oct; was "at each era's start") and through card events.
- **Thresholds close regions** (owner, 22 Oct). At 3 one region is closed to interventions and realignments, at 4 a
  second, at 5 a third; a region closed at 3 stays closed at 4 and 5. Below 3 nothing is closed. Placing influence
  is never blocked. Open (map topic): which regions close, and in what order. Suggested in the dialogue, not
  decided: the frontiers where the great powers meet close first.
- **Crisis at 6** (owner, 22 Oct). Whoever caused it draws one card from its own Contingency deck and loses that
  many points of score. Escalation then drops back to 3 and play goes on.
  - **Who caused it:** the side whose intervention pushed Escalation to 6; for a card event, the player who played
    the card, even when it is the rival's card (owner, 22 Oct: "The player who played it"). An opening pick counts
    as played by the side that picked it.
  - **The draw** is an ordinary draw (`contingency-deck.md`): the card is used up, counts toward the reshuffle,
    and everyone sees it. So a side can read its deck to judge what a crisis would cost it now. A high draw costs
    more score and also leaves that side's later draws in the cycle lower; a low draw costs little and leaves them
    higher.
  - The score itself is the scoring topic. Open: whether card modifiers can change a crisis draw, once modifiers
    exist.
- **Credibility** (owner, 22 Oct). Each turn each side must spend points on interventions: this upholds its
  **Credibility**. The requirement is highest when Escalation is low and falls as it rises: a calm world expects
  a great power to act, and a world at the brink excuses restraint. A side that falls short has a **credibility
  gap**, and the rival scores. The name comes from the deterrence literature (Schelling on commitment and
  credibility; the debate on a "reputation for resolve"). Open: the numbers, which wait for plays per turn and
  scoring; when the gap is counted; whether card events count toward it.
- **Cards that move it** (owner, 22 Oct). Sixteen cards move Escalation by 1, on top of what each already does.
  Their design lines are rewritten in the card rewording pass (question 7).
  - **Raise:** Desert Storm Coalition, Second Chechen War, Taiwan Strait Crisis (Era 1); ABM Treaty Withdrawal,
    Invasion of Iraq, North Korean Nuclear Test, Chinese Anti-Satellite Test (Era 2); Annexation of Crimea,
    Full-Scale Invasion, Hypersonics on Parade (Era 3).
  - **Lower:** Budapest Memorandum, Partnership for Peace, Oslo Accords, Test Ban Treaty (Era 1); Libya Disarms,
    India-US Nuclear Deal (Era 2).
  - **The arms-control cards** move it as part of their choice, and keep their points: Test Ban Treaty lowers it
    by 1 only if both sides ratify; ABM Treaty Withdrawal raises it by 1 only if LIO leaves the treaty.
- **Tech race links** (open, tech race topic): whether military-use branches move Escalation, and whether tech
  race moves count toward Credibility.

## Scoring (proposal topic 5)

Not decided. The owner will consider it further. Depends on the event-points question above. Escalation's crisis
and the credibility gap both need a score track.

## Owner's remaining questions

1. The tech race track: its branches, costs and what moving up gives, and its links to Escalation and
   Credibility.
2. Scoring, as above.
3. Country and region content for the six-region map, including which regions close at Escalation's thresholds,
   and in what order.
4. Answered 26 Oct: the intervention and realign formulas stand as written (#316, #317).
5. Credibility's numbers, once plays per turn and scoring are known.
