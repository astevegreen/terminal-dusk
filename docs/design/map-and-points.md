# The map, influence, points and escalation: owner decisions (W7)

Decided by the owner on 20 October 2026, in answer to the W7 proposal pack (`docs/proposals/w7/`, pull request
151). Where the owner said "apply the same rules as the reference game", this file spells the rules out in this
game's own words. The reference game is named by the owner only as the model for topic 3; none of its names, art or
text are used here. Updated on 22 October 2026 with the owner's answers from the escalation design dialogue: the
Escalation section, the Intervene action (formerly the coup) and the fourth action. Updated on 28 October 2026
with the owner's scoring answers (Scoring section, and battlegrounds by era in the Map section), and later that day
with the six-region map's numbers (Map section's "Map numbers", R24, #458).

Not yet built. Numbers marked "open" are for the owner to set.

## Map (proposal topic 1)

- **Six regions.** One map for the whole game, 1991 to 2025. Its countries, regions and borders do not change
  between eras.
- **Battlegrounds change by era** (owner, 28 Oct: "battlegrounds change between eras"; "each era has its own
  list"). Each era has its own list of battleground countries, set in the scenario. An era's list counts for its
  interventions, Escalation and scoring; when the next era enters, its list takes over. The lists are in "Map
  numbers" below.
- **Home box.** Russia and China are both part of the SAE home box; the United States is the LIO home box. Home
  boxes are not countries for placing or control. Countries next to a home box count as next to that side's
  influence. Russia's and China's borders decide which countries touch the SAE box (owner, 28 Oct, chosen in chat: H1): every
  country on the board that borders Russia or China by land or a short sea crossing touches it.
- **Hong Kong** is part of China.
- **Taiwan** starts LIO-aligned.
- **Crimea** starts as the history of 1991 says (owner), and is its own box on the map, not part of Ukraine
  (owner, 28 Oct).
- **Region contents** (owner, 28 Oct, chosen in chat: option 2): the countries, regions and links of
  `docs/proposals/map-content/option-2.md`, 41 countries plus Crimea. The data is
  `packages/content/scenarios/six-region-map.json` (#422), with Crimea's stability 2 like Ukraine's (owner, 28 Oct).

### Map numbers

Decided by the owner on 28 October 2026, in chat, answering the questions of `docs/proposals/map-numbers/README.md`
(X12, #438; smoke runs X13, #446). The numbers are option A of that proposal
(`docs/proposals/map-numbers/option-a-history.md`), except where the track starts. They are in
`packages/content/scenarios/six-region-map.json` (R24, #458).

- **Stabilities** (owner: "A, tune later"). Option A's: the placeholders of map-content option 2 with seven
  changes (Greece 3, Belarus 3, Georgia 1, Kazakhstan 3, Iraq 1, Iran 3, North Korea 4), 106 in all. A balance pass
  sets the final numbers once the Medium AI exists; until then these stand.
- **Battlegrounds by era** (owner: "A, move with history"). Option A's lists: Era 1 has 19, Era 2 has 20, Era 3
  has 19. The future era of the 2025-2027 scenario keeps Era 3's list.

| Region                          | Era 1 (1991-2001)                 | Era 2 (2001-2008)                         | Era 3 (2008-2025) and the future era |
| ------------------------------- | --------------------------------- | ----------------------------------------- | ------------------------------------ |
| Eastern Europe and Central Asia | Ukraine, Georgia, Kazakhstan      | Ukraine, Georgia, Kyrgyzstan              | Ukraine, Crimea, Belarus, Kazakhstan |
| East and South Asia             | Japan, North Korea, Taiwan, India | North Korea, India, Pakistan, Afghanistan | Japan, Taiwan, India                 |
| Europe                          | Germany, Poland, Serbia           | Germany, France, Poland                   | Germany, Poland, Greece              |
| Middle East and North Africa    | Iraq, Iran, Israel                | Iraq, Iran, Lebanon, Saudi Arabia         | Turkey, Libya, Syria, Iran           |
| Sub-Saharan Africa              | Rwanda, Nigeria, South Africa     | Nigeria, Somalia, South Africa            | Nigeria, South Africa                |
| The Americas                    | Mexico, Cuba, Brazil              | Mexico, Venezuela, Brazil                 | Mexico, Venezuela, Brazil            |

- **Region amounts** (owner: "Weighted"). Option A's, weighted by region: present / ahead / every battleground
  is 2 / 5 / 8 in Eastern Europe and Central Asia, East and South Asia and Europe (the three that can close), 2 / 4 /
  6 in the Middle East and North Africa, 1 / 3 / 4 in Sub-Saharan Africa and 1 / 3 / 5 in the Americas.
- **Score track** (owner: "20, middle"). 20 steps from the middle to each side's end, and the track **starts in
  the middle**, not option A's 2 steps towards LIO.
- **Taiwan and Crimea at the start** (owner: "LIO 3 / SAE 1"). Taiwan LIO 3, which controls it at stability 3;
  Crimea SAE 1, a foothold without control at stability 2. Every other country starts empty.
- Open: the balance pass on the stabilities (above), and the tech race tie-break on an even track (Scoring
  section). Turns, plays per turn and hand size in the scenario are still the first deck's placeholders (era
  lengths).

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
     Realigning is never forced: it is always a menu choice the side can decline, even when placing is impossible,
     and a side that realigns may stop early instead of using every attempt (owner, 26 Oct, #317 review). Points
     declined this way are not spent.
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
- **A turn-end payment only places influence** ("pay again at turn end"; owner, 28 Oct: "Yes, build it", the
  Turn-end-place reading, #426). Points a card spends once the turn's last play has finished go straight to
  placing: no intervention and no realignment, whatever the amount (an Ops swing still in force can make it 2).
  With no placement affordable they are lost. An intervention in a battleground raises Escalation however it turns
  out, so this removes a cheap push on the track just before it falls. Spends during the turn are unchanged.
- Open (tech race topic): whether event points may also be spent on the tech race.

## Escalation (proposal topic 4, option B)

Called "tension" until the owner's 22 October dialogue, which settled everything below except the parts that wait
on scoring's numbers, the map and the tech race.

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
  is never blocked. Order (owner, 28 Oct, chosen in chat: C1): Eastern Europe and Central Asia closes at 3, East and South Asia at 4,
  Europe at 5.
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
  scoring's numbers; when the gap is counted; whether card events count toward it.
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

Decided by the owner on 28 October 2026, choosing between the options in `docs/proposals/w7/5-scoring.md`
(option B, every region scores at each era's end, with no scoring cards).

- **When** (owner: "every era's end"). At the end of each era's last turn every region scores, in a fixed order.
  The order (owner, 28 Oct, chosen in chat: S1) is the closing order's own list: Eastern Europe and Central Asia,
  East and South Asia, Europe, then the three regions that never close, Middle East and North Africa, Sub-Saharan
  Africa, the Americas. The scenario sets it as data. The base game scores three times. There are no scoring cards, so "how scoring cards are played" has no answer
  to give.
- **How a region scores.** A side is **present** in a region if it controls at least one country there, **ahead**
  if it controls more countries and more battlegrounds there than the rival, and **holds every battleground** if
  it controls all of the region's battlegrounds. Each level scores a fixed amount for that region, and a side
  scores only the highest level it reaches (owner: "highest level only"). The region's battlegrounds are those on
  the list of the era that is ending (Map section).
- **A region with no battlegrounds that era** (owner: "countries only") still scores: ahead means controlling
  more countries there, and no side can hold every battleground.
- **Battlegrounds score on their own** (owner: "yes, +1 each"). Each battleground a side controls in a scoring
  region adds 1, beyond counting towards ahead and holding every battleground.
- **One shared score track** from LIO's end to SAE's end. A whole number that stops at its ends. Escalation's
  crisis moves it against the side that caused the crisis, and a credibility gap moves it towards the rival.
- **Each region moves the track once** (owner: "net, check per region"). Both sides score a region together, and
  the track moves by the difference towards the side that scored more.
- **How the game is won** (owner: "track end, or ahead in 2025"). A side that reaches its end of the track wins
  at once; during era scoring this is checked after each region, so the game stops before the next region scores. Otherwise, after the final era scores at the end of 2025, the side the track leans towards wins.
- **An even track at the end** (owner: "tie-break based on whoever is further ahead on the technology track …
  If that is also a tie, then it's a draw"). The side further ahead on the tech race track wins; if that is
  also even, the game is a draw.
- The six-region map's track (20 steps to each end, starting in the middle) and its amounts per region are in the
  Map section's "Map numbers" (owner, 28 Oct). Open: how "further ahead" on
  the tech race is measured (tech race topic); when the 2025-2027 scenario (eras.md) has its final scoring and
  win check.

## Owner's remaining questions

1. The tech race track: its branches, costs and what moving up gives, and its links to Escalation and
   Credibility.
2. Answered 28 Oct: scoring, as above, and its numbers for the six-region map (Map section's "Map numbers").
3. Answered 28 Oct: the six-region map's content is option 2 of `docs/proposals/map-content/`, with H1, Crimea
   as its own box, and closing order C1; the order regions score in is S1 (Scoring section). Its numbers too
   (Map section's "Map numbers"): option A's stabilities and battleground lists, weighted amounts, a 20-step track
   from the middle, Taiwan LIO 3 and Crimea SAE 1; a balance pass sets the final stabilities once the Medium AI
   exists ("A, tune later"). Still open: whether Kosovo and the Palestinian territories get a box (option 2 gives neither one), and
   whether every country must be reachable from both home boxes and long sea links are acceptable (option 2's tables
   assume yes; its Reach section shows the result).
4. Answered 26 Oct: the intervention and realign formulas stand as written (#316, #317).
5. Credibility's numbers, once plays per turn and scoring's numbers are known.
