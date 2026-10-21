Proposal, not a rule

# Topic 3: what points are spent on, and what a card's points award stands for

Part of the [W7 proposal](README.md). Decides nothing.

Today a card awards points with the `spendPoints` step ("LIO spends 2 points"), and playing a card for its action
points runs the same step with the card's Ops, changed by any `opsValue` modifier. The engine only records a
`pointsSpent` event: nothing is stored and no one wins (core-loop.md, "Playing a card"; deck-plan.md, owner
question 7). Owner questions 7, 19, 28, 44, 45 and 46 are all waiting on this topic. Core-loop.md also leaves open
"which new action joins the loop, and the full list of actions and their costs".

This topic has two parts: **what a card's points award stands for** (options A to C), and **the action menu** that
action points buy (options M1 to M3). Any meaning can go with any menu. All amounts stay whole numbers (Decision 1).

## Part 1: what a card's points award stands for

### Option A: points are actions on the map

- A card's "LIO 2" (`spendPoints lio 2`) becomes "LIO spends 2 points on the action menu": LIO answers a pending
  Decision, exactly as if it had played an Ops 2 card for points. Playing a card for its action points is the same.
- "Both get 1" means each side spends 1 point on the menu, in turn.
- The rules-text verb "spends points" (owner question 7) stays as it is: it now means what it says.

**Fit with the era files.** Every card keeps its numbers; only what the numbers do changes. Owner question 45: the
"both get 1" answers (Shock Therapy Backlash, China Joins the WTO, Litvinenko Poisoning, Parallel Plumbing, Hong Kong
Security Law) become real choices, since each side places where it needs to. Owner question 46: Test Ban Treaty
stays a stag hunt as long as 2 points of placing is worth more to a side than 1 (each side's own actions matter,
not only the gap). Owner question 28 (Ops swings change every point spent) becomes a rule that reads naturally:
"points spent by LIO count 1 more" makes LIO's event points stronger too. Owner question 44's dominant answers
(Budapest Memorandum, NATO Enlargement 1999, Oslo Accords, AI Compute Race, Tariff Shock, Populist Wave) and owner
question 19's (Partnership for Peace, Ghost Stories) would need checking again with real placements, not points.
Strains the Hold cards that "pay again at turn end" (Mogadishu, Shanghai Five, Euro Cash, Petrocaribe and others):
each turn-end payment becomes another round of decisions.

**Phone-first.** Many more prompts: a card like Dot-com Boom, which pays LIO after every card played this turn,
would ask LIO to place again after every play. Each prompt is a staged, undoable placement (Decision 6).

**Engine work.** `spendPoints` becomes a choice step: it creates a pending Decision for the named side (an action
choice, then `distributeInfluence` or `chooseCountries`). New Decision kinds need their UI prompts (hard rule 9).
The AI must handle the menu in every card (Decision 8). Every card test that checks a `pointsSpent` event would
check the new decision instead.

**Game length.** The longest: every event point is a map decision.

### Option B: points are victory points on a score track

- A card's "LIO 2" becomes "LIO scores 2": the score track moves 2 towards LIO. Playing a card for its action
  points is different: those points buy actions on the menu (Part 2).
- One track from LIO's end to SAE's end, stored as a whole number from 0 to 2 x the target, with the even point in
  the middle, so it is never negative and stops at its ends (Guardrails). The target is scenario data.
- "Both get 1" moves the track 1 one way and 1 the other: no change.

**Fit with the era files.** The simplest wording: every card says "scores" where it says "spends". Owner question
45: the "both get 1" answers do nothing, so Shock Therapy Backlash, China Joins the WTO, Litvinenko Poisoning,
Parallel Plumbing and Hong Kong Security Law would need a redesign. Owner question 46: Test Ban Treaty stops being a
stag hunt (saying no is always best), so it needs a redesign too. Owner question 28: "points spent count 1 more"
would then change both scoring and actions, so the engine would need to tell them apart, or the cards reword to
"scores 1 more" for events only. Kosovo Declares Independence ("each side 1") becomes tag-only.

**Phone-first.** The lightest: an event's points are one track move, shown as an event animation, no prompt.

**Engine work.** A score track in public state, a `moveTrack` (or `awardVP`, Decision 4's "award VP") step that
replaces `spendPoints` in card data, a `trackMoved` event kind with its presentation entry, and a way to keep
action points (play for points) apart from event points. `pointsSpent` stays only for play-for-points.

**Game length.** Short and fast: events never cause map decisions.

### Option C: points are each side's own standing, not a gap

- A card's "LIO 2" becomes "LIO gains 2 standing": each side has its **own** standing total, from 0 to a cap, and
  the totals are not netted against each other. Playing a card for its action points buys actions (Part 2).
- "Both get 1" gives each side 1 standing: each total rises.
- Standing then pays off in scoring (topic 5, option C): for example a side whose standing reaches an era's goal
  scores that era, or standing can be turned into actions at turn end.

**Fit with the era files.** Owner questions 45 and 46 resolve the way the cards were designed: "both get 1" is a
real gain for each side, and Test Ban Treaty is a true stag hunt (2 each beats 1 each). Helps the "both prosper"
story of China Joins the WTO and Parallel Plumbing. Owner question 44's dominant answers would still need checking.
Strains the "-1 Ops this turn" costs that pay for a gain (Kyoto Protocol, Asian Financial Crisis, Taiwan Strait
Crisis, Arab Spring, October 7 and Gaza): the cost is in actions and the gain in standing, two different currencies,
so their balance must be checked again.

**Phone-first.** Two small numbers on screen (one per side), easy to show next to the score area.

**Engine work.** Two standing totals in public state, each with a range (Guardrails), a step that adds to a side's
total (replacing `spendPoints` in card data), a `standingChanged` event with its presentation entry, and the same
split between action points and event points as option B.

**Game length.** Close to option B: events do not create map decisions.

## Part 2: the action menu (what action points buy)

Core-loop.md says one new kind of action joins the familiar ones, and which one is not decided. Each menu below
names candidates only. Without dice, a coup's or realignment's luck is a Contingency draw (1 to 6) by the acting
side (owner question 24).

### Option M1: place influence, coup, realign, plus one new action

- **Place influence** (topic 2's rules). **Coup:** spend points in one country; draw from your Contingency deck;
  the points plus the draw are compared with the country's stability, and the amount by which they beat it
  removes rival influence first and then adds your own (the exact comparison is the owner's choice). **Realign:** both sides draw; the difference, adjusted for neighbours you control, removes
  rival influence.
- **New action candidates:** _Sanctions_ (spend points to lower the rival's action points next turn, with a
  minimum of 1); _Cyber operation_ (remove 1 rival influence in any country, no adjacency, but tension rises; topic
  4); _Information campaign_ (raise or lower a country's stability by 1 until the era ends, within a range).

**Fit.** Helps the military Hot cards (Desert Storm Coalition, Invasion of Iraq, Full-Scale Invasion, Second
Chechen War), whose stories are coups and wars. Cyber and sanctions fit the theme lists (Golden Shield, Estonian
Cyberattacks 2007, Stuxnet; Ruble Default, Parallel Plumbing). **Phone-first:** four actions means a menu step before
every spend. **Engine work:** `coup` and `realign` steps (Decision 4's atomic steps), the `coupResult` hook
(Decision 4), a `chooseAction` Decision kind and its prompt, events for each action, and the tension track (topic 4)
for coups. **Game length:** the longest menu and the most decisions.

### Option M2: place influence, coup, plus one new action (no realignment)

As M1 without realignment. **Fit:** the same as M1 for military cards; loses nothing in the era files, which never
mention realignment. **Phone-first:** three choices, one fewer draw to show. **Engine work:** as M1 without
`realign`. **Game length:** a little shorter than M1.

### Option M3: place influence plus one new action only (no coups)

Only placing and the new action (for example _Pressure_: remove 1 rival influence per 2 points in a country next
to your influence, no draw). Contingency draws then come only from card events. **Fit:** helps the non-military
themes (finance, energy, information, climate), which are most of the deck (deck-plan.md, "Theme coverage");
strains the war cards, whose events would be the only "military" moments. **Phone-first:** the simplest; two
choices. **Engine work:** the least: no `coup` step, no `coupResult` hook, and a tension track only if cards move
it (topic 4). **Game length:** the shortest of the three menus.

## Questions for the owner

1. What does a card's "LIO 2" stand for: actions on the map (A), score on one shared track (B), or each side's own
   standing (C)?
2. Should playing a card for its action points and a card's event points be the same thing (A) or different
   things (B, C)?
3. Under B, the six "both get 1" and stag-hunt cards (owner questions 45 and 46) need a redesign. Is that acceptable?
4. Which actions are on the menu: M1, M2 or M3? And which new action: one of the candidates named, or another?
5. How is a coup's result worked out without dice? The formula in M1 is only an example.
