Proposal, not a rule

# The tech race track: options

Sprint backlog X7, owner question 1 in `docs/design/map-and-points.md`: the tech race track's branches, costs,
what moving up gives, and its links to Escalation and Credibility. This file lays out three options with their
trade-offs. It decides nothing, and nothing here is a rule until the owner picks an option and it is promoted into
`docs/design/`.

Every number below is a whole number and a **placeholder**, there only to make the trade-offs concrete. None is a
proposed value.

## What is settled, and not reopened here

- **The tech race is the fourth action** on the action menu (owner, 22 Oct: "let's go with (a) The track is the
  fourth action"; `map-and-points.md`, "Points and actions", point 3; `core-loop.md`, "The new action").
- **A side spends a card's points to move up the track.** Ops modifiers (`opsValue`) apply to those points, as to
  any points spent on the menu.
- **Until the track is designed, the menu is place, intervene, realign.**
- Escalation (0 to 6, starting at 2, +1 for each intervention in a battleground, -1 at each turn end, regions closed
  at 3, 4 and 5, a crisis at 6), the crisis's "who caused it" rule for interventions and card events, and
  Credibility's existence are decided in `map-and-points.md`. The options below only add links to them.

## What every option must respect

- **Same core rules for both sides** (`sides.md`). No option gives one side a different track, different costs or
  different rewards. The differences between the sides stay in the cards, the starting map, the eras and the one
  special ability each.
- **SAE is one side with one pool** (`sides.md`). No option gives Russia and China separate tracks or separate
  progress.
- **No clash with a special ability** (`special-abilities.md`, options L1 to L3 and S1 to S3). No option's reward
  copies an ability option's effect: none changes the points of a rival's card played for points (L1, S2), none
  redraws a Contingency card (L2), none adds or widens a placement (L3, S3), and none primes a later play in the
  turn (S1). Points changed by an ability buy steps exactly like any other points; the track neither reads nor
  changes the ability. Each option repeats this check below.
- **Stacking with L2.** L2 (LIO redraws the first 1 it draws from its own Contingency deck each turn) acts on the
  same realignments and interventions whose totals and results these options' rewards raise. The two do not
  clash: L2 replaces the drawn number before it is used, and a track bonus is added afterwards, so both apply and
  the order does not change the result. They do add up for LIO only, so if the owner picks L2, the gap between a
  side with tech bonuses and one without would be wider for LIO. Whether that stacking is acceptable is question 11.
- **Integers only, every wait is a Decision, the track is data** (`architecture.md`, Decisions 1 and 4). Each
  option says which state fields, Decisions and schema it needs.
- **Scoring is not decided.** No option chooses a scoring rule; each says what it would need from one.
- **Points are not stored** between plays (`map-and-points.md`, "Event points"). No option keeps a "partial
  progress" counter, so each says what happens to points a step cannot use.
- **Splitting points is open** (`map-and-points.md`, point 1: whether all of a card's points go to one action or
  can be split). Each option says what happens to leftover points under either answer.

## Option T1: one shared tech lead

**The track.** One shared track with one marker. It runs from "SAE lead 3" through "parity" (the start) to
"LIO lead 3": seven positions, stored as one whole number from -3 to 3 (placeholder ends). LIO moves the marker
towards its end, SAE towards its own. There are no branches.

**Cost of each step.** 2 points per position moved (placeholder), the same in both directions and for both sides.

**What each step gives** (to the side the marker currently favours, for as long as it stays there; the same
table for both sides):

| Lead (placeholder) | What the leading side has while the marker is there                            |
| ------------------ | ------------------------------------------------------------------------------ |
| 0 (parity)         | nothing                                                                        |
| 1                  | +1 to its total in its own realignments                                        |
| 2                  | the above, and +1 to the result of its own interventions                       |
| 3 (its end)        | the above; entering lead 3 raises Escalation by 1; scoring may read it (below) |

**Shared or per-side.** Shared: one marker, so the two sides can never hold the same step. A side behind must
first pull the marker back to parity, removing the rival's lead one step at a time, before it can build its own.

**How a play is spent.**

- **Several steps per play:** yes. An Ops 4 card moves the marker 2 positions (at 2 points each).
- **Leftover points** (an odd number, or more points than the steps left to the end): if the owner allows
  splitting, they go to another action on the menu; if not, they are lost.
- **At the end of the track:** a side whose lead is already 3 cannot choose the tech race (the action is not
  legal for it, as there is nothing to buy). The rival can still pull the marker back, so the action never closes
  for both.
- **Both sides reaching the same step:** cannot happen; there is one marker.

**The four open links** (this option's answers, not decisions):

- **Event points (`spendPoints`):** may be spent on it, like any action on the menu.
- **Escalation:** moving the marker does not move Escalation, except that entering lead 3 raises it by 1
  (a lead that large reads as a threat). A step funded by event points can therefore push Escalation to 6; who
  caused that crisis is a question for the owner (questions 4 and 5 below), not answered here.
- **Credibility:** tech race moves do not count toward Credibility. Credibility stays about interventions.
- **Scoring:** reaching a step scores nothing by itself. The option needs from scoring one place where the lead
  is read (for example at each era's end, or at the game's end) and turned into score; without that, lead 3's
  only lasting value is lead 1 and 2's bonuses.

**Same rules for both sides, and special abilities.** Both sides use the same marker, cost and table. The rewards
change realignment totals and intervention results only. No special ability option changes a total or a result
directly; L2 changes the Contingency draw inside them, and stacks with the lead bonus rather than clashing with
it (see "Stacking with L2" above). Points an ability changes (L1, S1, S2) buy positions like any other points.

**Trade-offs.**

- **How often it is chosen.** Often in short bursts: every rival push threatens a standing bonus to both of a
  side's attack actions, so both sides answer it. Because Credibility requires intervention points each turn,
  the tech race competes mainly with placing. Risk: a tug of war that cancels out turn after turn and feels
  like wasted plays.
- **Escalation.** Only lead 3 raises it, once per entry. Because Escalation falls by 1 at each turn end, a lead
  pushed to 3 and back repeatedly adds steady pressure. At high Escalation, when regions are closed to
  interventions and realignments, the tech race (like placing) is never closed, so it becomes the outlet for
  points; lead bonuses for intervening matter less then. Whether thresholds should close the tech race too is
  question 9.
- **Theme and history.** Reads as a single global edge in technology, the way 1990s US dominance gave way to a
  contested field: Dot-com Boom (Era 1), Golden Shield (Era 1), First Crew on the ISS (Era 1), Smartphones and
  Social Networks (Era 2), Chinese Anti-Satellite Test (Era 2), Chip Chokepoint (Era 3), Rare Earth Squeeze
  (Era 3), AI Compute Race (Era 3). It does not tell cyber, space and arms apart.
- **Easy AI weights.** The simplest of the three: one number, symmetric. The AI needs a weight for "move the
  lead one step" that rises when the rival leads (to remove its bonuses) and for the value of bonuses on its own
  realignments and interventions, plus a check against entering lead 3 when Escalation is at 5.
- **Engine and content work.** Public state: one integer, `techLead`, from -3 to 3 (sign by side). One new
  action on the menu and, if several positions per play are allowed, no extra Decision: the number of positions is
  part of the menu answer (a compound answer, Decision 1). One new event kind ("tech lead moved") with its log
  line (hard rule 9). Scenario schema: the track's ends, cost per position and the reward table as data. New hook
  points: realignment total and intervention result (Decision 4 plans "coup result"; this would build it and its
  realignment twin). Escalation's +1 at lead 3 reuses R17's track move.

## Option T2: one track per side

**The track.** Each side has its own track with the same five levels, 0 (the start) to 4 (placeholder). There
are no branches. A side's level is its own; the rival's level never pushes it back.

**Cost of each step** (placeholders, the same for both sides):

| Level reached | Cost in points | What the side has from then on                                      |
| ------------- | -------------- | ------------------------------------------------------------------- |
| 1             | 2              | +1 to its total in its own realignments                             |
| 2             | 2              | +1 to the result of its own interventions                           |
| 3             | 3              | a one-off award of 1 score (placeholder), if scoring allows it      |
| 4 (the end)   | 3              | a one-off award of 1 more score (placeholder), if scoring allows it |

Rewards add up: a side at level 2 has both the level 1 and level 2 bonuses. The award at levels 3 and 4 is the
same for whichever side gets there, and the same whether it gets there first or second.

**Shared or per-side.** Per side. Both sides can reach the same level; neither blocks, removes or outbids the
other's progress, and getting there first gives nothing extra.

**How a play is spent.**

- **Several steps per play:** no. One play buys at most one level, and must carry at least that level's cost.
- **Leftover points** above the cost: if the owner allows splitting, they go to another action; if not, they are
  lost. (Example: Ops 4 on a level costing 2 loses 2 points unless splitting is allowed.)
- **At the end of the track:** a side at level 4 cannot choose the tech race; the action is not legal for it.
- **Both sides reaching the same step:** both simply have it.

**The four open links** (this option's answers, not decisions):

- **Event points (`spendPoints`):** may not be spent on it. Only a card played for its points can buy a level.
  Event points stay with place, intervene and realign.
- **Escalation:** moving up does not move it.
- **Credibility:** tech race moves do not count toward it.
- **Scoring:** levels 3 and 4 need scoring to accept one-off awards outside a scoring card. If scoring has no
  such awards, levels 3 and 4 give nothing and the track should end at level 2 (or the owner names other
  rewards).

Since no event points can fund a step and no step moves Escalation, this option raises no new "who caused it"
question.

**Same rules for both sides, and special abilities.** Both tracks are identical. The rewards change realignment
totals and intervention results and award score. No special ability option changes a total or a result directly
or awards score; L2 changes the Contingency draw inside realignments and interventions, and stacks with the level
bonuses rather than clashing with them (see "Stacking with L2" above). Points an ability changes buy levels like
any other points.

**Trade-offs.**

- **How often it is chosen.** A steady investment: about four plays per side over the game (placeholder costs),
  mostly early, since bonuses held longer are worth more. Once a side reaches the end it never chooses the action
  again, so late in the game the menu is effectively back to three actions. With no rival interaction, a side
  that skips it falls behind for good.
- **Escalation.** No direct link. Indirectly, the level 2 bonus makes interventions stronger, and interventions
  in battlegrounds raise Escalation, so a higher level may mean more of them. At high Escalation the track
  is still open (as placing is), so it is a safe place to put points while regions are closed.
- **Theme and history.** Reads as each bloc building its own base (research, industry, networks) rather than a
  head-to-head race: Dot-com Boom (Era 1), Golden Shield (Era 1), Smartphones and Social Networks (Era 2), Private
  Constellation (Era 3), Chip Chokepoint (Era 3), Rare Earth Squeeze (Era 3), AI Compute Race (Era 3). Less
  sense of a race; nothing the rival does slows you, which fits poorly with cards like Chip Chokepoint whose
  history is about denying the other side.
- **Easy AI weights.** Needs one weight per level, highest early in the game. Simple, since the rival's track
  never matters to the choice.
- **Engine and content work.** Public state: one integer per side, `techLevel` for `lio` and `sae`, 0 to 4
  (public, since both sides see it). One new action on the menu; no new Decision (one level per play, so the
  answer is just "tech race"). A rule that the action needs at least the next level's cost. One new event kind
  ("tech level reached") with its log line. Scenario schema: the level list with costs and rewards as data. The
  same two new hook points as T1. A one-off score award needs scoring's score track.

## Option T3: three branches per side

**The track.** Each side has its own three branches, the same for both sides, each with three steps (0 is the
start; 3 is the branch's end). Names are placeholders:

- **Networks** (computing, the internet, information control),
- **Orbit** (satellites, sensors, undersea cables),
- **Arsenal** (missiles, missile defence, nuclear programmes): the military-use branch.

**Cost of each step** (placeholders, the same in every branch and for both sides): step 1 costs 2 points, step 2
costs 3, step 3 costs 4.

**What each step gives** (rewards add up within a branch; the same for both sides):

| Branch   | Step 1                                    | Step 2              | Step 3 (the end)                                         |
| -------- | ----------------------------------------- | ------------------- | -------------------------------------------------------- |
| Networks | +1 to its own realignment totals          | +1 more (+2 in all) | a one-off score award (placeholder 1), if scoring allows |
| Orbit    | +1 to its own intervention results        | +1 more (+2 in all) | a one-off score award (placeholder 1), if scoring allows |
| Arsenal  | counts 1 toward its Credibility each turn | counts 2 in all     | counts 3 in all                                          |

Every Arsenal step reached raises Escalation by 1. Networks and Orbit steps do not move it.

**Shared or per-side.** Per side: each side has its own three branches. Both sides can reach the same step in a
branch; neither blocks the other, and getting there first gives nothing extra.

**How a play is spent.**

- **Several steps per play:** yes, but in one branch only, and in order. Ops 4 buys step 1 and nothing more in a
  fresh branch (2, then 3 more needed), or step 3 alone in a branch already at step 2.
- **Leftover points:** if the owner allows splitting, they go to another action (or, as a sub-option, another
  branch); if not, they are lost.
- **At the end of a branch:** that branch cannot be chosen; the action stays legal while any branch has a step
  left. With all three branches at their end, the action is not legal for that side.
- **Both sides reaching the same step:** both simply have it.

**The four open links** (this option's answers, not decisions):

- **Event points (`spendPoints`):** may be spent on Networks and Orbit, not on Arsenal. (Alternative within the
  option: on all three.) If the owner allows them on Arsenal, an event can fund a step that raises Escalation to
  6, and who caused that crisis is a question for the owner (question 5 below), not answered here.
- **Escalation:** each Arsenal step raises it by 1; the other branches do not move it. Even when funded only by
  a card played for points, an Arsenal step that reaches 6 is an action that is neither an intervention nor a
  card event, so who caused it is also a question (question 4).
- **Credibility:** Arsenal steps count toward it, as shown (a standing posture upholds a side's word); the other
  branches do not. Since Credibility's numbers are open, the Arsenal amounts are placeholders that wait for them.
- **Scoring:** Networks and Orbit step 3 need scoring to accept one-off awards outside a scoring card; without
  that, those branches end at step 2. Arsenal needs nothing from scoring directly, only Credibility's gap scoring.

**Same rules for both sides, and special abilities.** Both sides have the same three branches, costs and
rewards; SAE's branches are one set for the whole side. The rewards change realignment totals, intervention
results, Credibility and Escalation, and award score. No special ability option changes a total, a result,
Credibility or Escalation directly, or awards score; L2 changes the Contingency draw inside realignments and
interventions, and stacks with the Networks and Orbit bonuses rather than clashing with them (see "Stacking with
L2" above). Points an ability changes buy steps like any other points.

**Trade-offs.**

- **How often it is chosen.** The most often of the three: nine steps per side to buy, and Arsenal competes
  directly with interventions for meeting Credibility. That is also its risk: if an Arsenal step is a cheaper way
  to meet Credibility than intervening, sides stop intervening, which undercuts what Credibility is for. The
  numbers would need care, once Credibility's own are set.
- **Escalation.** Arsenal adds a second, side-chosen way to raise it, next to battleground interventions: up to
  3 rises per side over the game. A side can use Arsenal to push Escalation toward a threshold that closes a
  region the rival needs, but at 5 the next Arsenal step risks a crisis at its own cost. Escalation's fall at turn
  end absorbs a step per turn. Networks and Orbit stay open at every Escalation level.
- **Theme and history.** The richest fit, since the era files' technology cards fall into the three branches:
  - Networks: Dot-com Boom, Golden Shield (Era 1); Smartphones and Social Networks, Estonian Cyberattacks 2007
    (Era 2); Stuxnet, Chip Chokepoint, Rare Earth Squeeze, AI Compute Race (Era 3); Open-Weight Model Leak
    (optional future cards).
  - Orbit: First Crew on the ISS (Era 1); Chinese Anti-Satellite Test (Era 2); Private Constellation (Era 3);
    Undersea Cable Patrols, Cable Cut in the Baltic, Allied Drone Wall (optional future cards).
  - Arsenal: Test Ban Treaty (Era 1); ABM Treaty Withdrawal, North Korean Nuclear Test, Natanz Revealed (Era 2);
    AUKUS, Hypersonics on Parade (Era 3).
  - The "Arsenal raises Escalation" link mirrors the security dilemma these cards describe. Later card rewording
    could let such cards refer to a branch, but this option does not ask for that.
- **Easy AI weights.** The hardest of the three: a weight per branch and step, which branch to buy, and when an
  Arsenal step is worth its Escalation cost. It must read Escalation (never buy Arsenal at 5 unless it wants the
  crisis) and its Credibility shortfall.
- **Engine and content work.** Public state: per side, three integers (one per branch), 0 to 3. A new Decision
  kind to choose the branch (and how many steps) with its UI prompt, unless the menu answer carries it as one
  compound answer; either way the answer's shape changes (hard rule 9 applies to any new kind). One new event
  kind ("tech step reached") with its log line. Scenario schema: branches, costs, rewards and the
  Escalation-moving flag per branch as data, so a mod can rename or reshape them. The same two new hook points as
  T1, plus a Credibility count that can read the track (Credibility is not built yet; R17 builds Escalation only).

## The options at a glance

| Option | Branches         | Shared or per side | Several steps per play | Event points        | Moves Escalation | Counts for Credibility | Needs from scoring       |
| ------ | ---------------- | ------------------ | ---------------------- | ------------------- | ---------------- | ---------------------- | ------------------------ |
| T1     | one              | shared marker      | yes                    | yes                 | at lead 3 only   | no                     | a place to read the lead |
| T2     | one              | per side           | no                     | no                  | no               | no                     | one-off awards           |
| T3     | three (per side) | per side           | yes, in one branch     | yes, not on Arsenal | Arsenal steps    | Arsenal steps          | one-off awards           |

## Questions for the owner

1. Which option, if any, is closest to what you want: a shared tug of war (T1), a private ladder per side (T2), or
   branches with a military-use branch (T3)? Or a mix?
2. May event points (`spendPoints`) be spent on the tech race at all, and if so on every part of it?
3. Should moving up the track (or only a military-use branch) move Escalation, and by how much?
4. If a tech race step paid for with a card played for its points pushes Escalation to 6, who caused the crisis?
   `map-and-points.md` defines "who caused it" only for interventions and card events.
5. If a tech race step paid for with event points (`spendPoints`) pushes Escalation to 6, who caused the crisis:
   the side that spent the points, or the player who played the card whose event gave them (who may be the
   rival, for a rival's card played for points or a "Both get 1" line)?
6. Should tech race moves count toward Credibility, and if so, should they be able to replace interventions
   entirely?
7. Should reaching a step ever score, and is a one-off award outside a scoring card something scoring may have?
8. Can one play buy several steps, and should leftover points be lost? (This waits partly on the open question of
   whether a card's points can be split between actions.)
9. Should Escalation's thresholds close the tech race too, or only interventions and realignments as now?
10. Should the rewards stay within realignment totals, intervention results, Credibility and score (as here, to
    keep clear of every special ability option), or may they touch hand size, placement or card points?
11. If LIO's ability is L2 (redraw the first 1 each turn), may a tech race bonus to realignment totals or
    intervention results stack with it, or should the rewards then avoid realignments and interventions?
