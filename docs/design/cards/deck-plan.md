# First deck: plan

Status: stage 1 design, awaiting the owner's review. Nothing here is a rule of the game; it is cards only.
Later stages build the JSON from the per-era files. The Notion "Card concepts" database was the starting point;
every card here is also a Notion row with Status "Draft".

## Index

- [era-1.md](era-1.md): 28 cards, 1991 to 9/11
- [era-2.md](era-2.md): 29 cards, 9/11 to the 2008 crash
- [era-3.md](era-3.md): 28 cards, 2008 to 2025, plus 6 optional roles-only "future" cards (2025-2027)
- [name-swap.md](name-swap.md): every real name in card text and a neutral replacement
- [progress.md](progress.md): stage tracker

## The deck at a glance

| Era                          | LIO    | SAE    | Neutral | Total                                |
| ---------------------------- | ------ | ------ | ------- | ------------------------------------ |
| Era 1 (1991-2001)            | 8      | 13     | 7       | 28                                   |
| Era 2 (2001-2008)            | 10     | 11     | 8       | 29                                   |
| Era 3 (2008-2025)            | 8      | 12     | 7       | 27                                   |
| Future (2025-2027, optional) | 2      | 2      | 2       | 6                                    |
| **All**                      | **28** | **38** | **24**  | **90** (84 without the future cards) |

The plan had 13 / 13 / 8 per era (108 cards). The owner then removed 18 cards whose Notion rows they had trashed,
because the events were not well known or significant enough (Owner question 8). Their ids stay unused, so the
other cards keep their ids. The reasoning below is the plan's, kept for the record; the LIO side is now short in
Era 1 and Era 3, which the TEST scenario's smaller game absorbs (see "Counts and hand size").

Why 13 / 13 / 8 per era (the plan):

- Equal LIO and SAE counts in every era keep both sides fun in every era, including Era 1, which the brief says
  modern players may not remember. No era is "LIO's era" or "SAE's era" by card count; the events carry that.
- 13 per side is the smallest count that meets the stopgap for the TEST scenario below with one spare card, so
  Era 1 alone can start a game. Three equal eras keep the draw pile's growth even (34 cards enter per era).
- 8 neutral cards per era (about a quarter of the era) is enough to make neutral cards a real part of every hand
  while keeping the rival-card dilemma (below) the main event. Neutral cards could not draw a Contingency card when this deck was
  built (Owner question 1; allowed since #126), so too many of them would make the deck feel flat.

## Ops spread

Per era, per side, as planned (identical in all three eras):

| Ops           | LIO       | SAE       | Neutral   |
| ------------- | --------- | --------- | --------- |
| 1             | 3         | 3         | 3         |
| 2             | 6         | 6         | 4         |
| 3             | 3         | 3         | 1         |
| 4             | 1         | 1         | 0         |
| Sum / average | 28 / 2.15 | 28 / 2.15 | 14 / 1.75 |

Justification:

- The central dilemma is playing a rival's card for its Ops and eating its event. That only bites when the Ops are
  worth having, so each side gets exactly one Ops 4 "hot" card and three Ops 3 cards per era: few enough that a
  rival holding one must think, common enough that it happens most games.
- Ops 2 is the workhorse (almost half the deck): an event worth about 2 points, or 2 points of actions. A card's
  event is worth roughly its Ops, give or take 1, so no card is strictly better played one way.
- Ops 1 cards are "openers": cheap events that set the turn's tempo (a +1 or -1 Ops modifier) and are the natural
  secret opening pick, where only the event matters. Three per side per era means a side usually holds one.
- Neutral cards are lighter (no Ops 4, one Ops 3) because both sides can play them for the event; a heavy neutral
  card would be a free 3 or 4 Ops for whoever draws it. The one Ops 3 neutral per era is a world-shaking event
  (Asian crisis, China in the WTO, COVID-19) that both sides want to shape.
- Same spread in all eras so the TEST scenario's balance does not drift when a new era enters the pile.

After the owner removed 18 cards, the built spread (cards of Ops 1 / 2 / 3 / 4) is:

| Era   | LIO     | SAE     | Neutral |
| ----- | ------- | ------- | ------- |
| Era 1 | 2/4/1/1 | 3/6/3/1 | 2/4/1/0 |
| Era 2 | 3/5/1/1 | 3/5/2/1 | 3/4/1/0 |
| Era 3 | 2/5/1/0 | 3/5/3/1 | 2/4/1/0 |

Era 3 LIO has no Ops 4 card now (Sanctions Wall was removed). Whether to rebalance is an open point for the owner.

## Counts and hand size

Hands refill to the scenario's hand size at the start of every turn (core-loop.md, "Refilling hands"; Owner
question 27), so the old stopgap (each side dealt `turns x (1 + plays per turn)` non-neutral cards) is gone. The
numbers below are placeholders, not rules (Owner question 4), except the hand size of 8, which is the owner's:

```
TEST scenario "first-deck-test" (ALL VALUES ARE PLACEHOLDERS)
  TURNS = 4            was 6; cut when the owner removed 18 cards, while the stopgap still applied
  PLAYS_PER_TURN = 1   one alternating play each after the opening pick
  HAND_SIZE = 8        the owner's (question 27); the scenario's handSize, and the turn 1 refill deals it
  eras: era-2 enters on turn 2, era-3 on turn 3, the future cards on turn 4 (were 3, 5 and 6)
  contingency: default decks (1-6 per side); the gamble thresholds below assume this
```

Before the refill rule, the stopgap needed 4 x (1 + 1) = 8 non-neutral cards per side at the start; the notes
below are kept for the record. Now the 28 Era 1 cards are shuffled into the draw pile and the turn 1 refill deals
8 to each side from it (16 of 28), so a game needs at least 2 x 8 cards when it starts, which createGame checks.

- Strict reading (cards at the start, Era 1 only): 8 LIO and 13 SAE. Met exactly on the LIO side, no spare. The
  practice game deals each side 6 of its own cards, 2 of the rival's and 3 neutral ones; the 6 Era 1 cards left
  over (5 SAE, 1 neutral) start in the draw pile.
- Cumulative reading (all eras in play by the end): 26 LIO and 36 SAE. Met many times over.
- If the owner prefers a longer game (say TURNS = 9, PLAYS_PER_TURN = 3, need 36), Era 1 alone would fail the
  strict reading and the owner would need either more Era 1 cards or the cumulative reading (Owner question 5).

## Notation used in the era files

Each card lists a **Playable** line in this compact notation. The builder turns it into JSON one for one; there
is nothing to decide. Variables are `v` (an answer) and `d` (a draw); a second one in the same card is `v2`/`d2`.

| Notation                          | JSON step                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `marker "label"`                  | `{ "op": "marker", "label": "label" }`                                                                                                   |
| `marker "label" lasting`          | `{ "op": "marker", "label": "label", "lasting": true }` (kept for the rest of the game)                                                  |
| `spend lio 2`                     | `{ "op": "spendPoints", "side": "lio", "amount": 2 }`                                                                                    |
| `draw lio -> d`                   | `{ "op": "drawContingency", "side": "lio", "bind": "d" }`                                                                                |
| `add d +1`                        | `{ "op": "addToNumber", "var": "d", "amount": 1 }`                                                                                       |
| `if d >= 4 { A } else { B }`      | `{ "op": "if", "cond": { "op": "atLeast", "var": "d", "value": 4 }, "then": [A], "else": [B] }`                                          |
| `if d <= 2 { A }`                 | `{ "op": "if", "cond": { "op": "atMost", "var": "d", "value": 2 }, "then": [A] }`                                                        |
| `ask lio "Q?" -> v`               | `{ "op": "choose", "who": "lio", "decision": { "kind": "yesNo" }, "bind": "v" }` (the question is the rules text)                        |
| `ask both "Q?" -> v`              | same with `"who": "both"`                                                                                                                |
| `if yes v { A } else { B }`       | `{ "op": "if", "cond": { "op": "yes", "var": "v" }, "then": [A], "else": [B] }`                                                          |
| `if yes v[lio] { A } else { B }`  | `{ "op": "if", "cond": { "op": "yes", "var": "v", "side": "lio" }, "then": [A], "else": [B] }`                                           |
| `if has "label" { A } else { B }` | `{ "op": "if", "cond": { "op": "has", "marker": "label" }, "then": [A], "else": [B] }`                                                   |
| `mod lio +1 (turn)`               | `{ "op": "modifier", "mod": { "hook": "opsValue", "side": "lio", "add": 1 }, "duration": { "kind": "turnEnd" } }`                        |
| `mod sae -1 min 1 (turn)`         | same with `"add": -1, "min": 1`                                                                                                          |
| `mod both +1 (turn)`              | same with `"side": "both"`                                                                                                               |
| `on turnEnd { A }`                | `{ "op": "trigger", "hook": "turnEnd", "do": [A], "duration": { "kind": "turnEnd" } }`                                                   |
| `on cardPlayed (turn) { A }`      | `{ "op": "trigger", "hook": "cardPlayed", "do": [A], "duration": { "kind": "turnEnd" } }`                                                |
| `once-only`                       | `"flags": { "removeAfterEvent": true }` (a card flag beside `effect`, not a step)                                                        |
| `if played sae { A } else { B }`  | `{ "op": "if", "cond": { "op": "playedBy", "side": "sae" }, "then": [A], "else": [B] }`                                                  |
| `show sae`                        | `{ "op": "revealHand", "side": "sae" }` (SAE's hand is shown to LIO)                                                                     |
| `discard sae 1`                   | `{ "op": "discardFromHand", "side": "sae", "count": 1 }` (at random)                                                                     |
| `on cardPlayed by lio (turn) {A}` | `{ "op": "trigger", "hook": "cardPlayed", "filter": { "op": "playedBy", "side": "lio" }, "do": [A], "duration": { "kind": "turnEnd" } }` |

Steps separated by `;` are listed in order in `effect`. Braces nest.

Rules-text templates (the rules text says exactly what the JSON does; one sentence per step, in order):

- `marker "x"`: _Record "x"._
- `spend lio 2`: _LIO spends 2 points._ (the step only records a `pointsSpent` event today; Owner question 7)
- `draw lio -> d`: _Draw from LIO's Contingency deck._ then _If the result is 4 or more, ...; otherwise ..._
- `add d +1`: _Add 1 to the result._
- `ask lio "Q?"`: _LIO chooses: Q If yes, ... If no, ..._ / `ask both`: _Each side chooses: Q LIO, yes: ...; no: ... SAE, yes: ...; no: ..._
- `mod lio +1 (turn)`: _LIO's plays for points are worth 1 more until the end of the turn._ / `-1 min 1`: _... 1 less, never below 1, ..._
- `on turnEnd`: _At the end of this turn, ..._ / `on cardPlayed (turn)`: _After every card played this turn, by either side, ..._
- `flags.removeAfterEvent`: _If this card's event happens, remove it from the game afterwards._
- `if played sae`: _If SAE played this card, ...; otherwise, ..._ ("played" covers both a play for points and the
  secret opening pick, so a rival's card bites the same either way.)
- `show sae`: _SAE's hand is shown to LIO._
- `discard sae 1`: _SAE discards 1 card at random._
- `on cardPlayed by lio (turn)`: _After each later card LIO plays this turn, ..._

Facts every builder must know (engine, not design):

- A `spendPoints` amount is changed by the `opsValue` modifiers in force when the step runs (stack.ts). Every card
  here puts its `spend` steps before its `mod` steps on the same side, so a card's own modifier never shrinks its
  own spend; the test for each card plays it first in a fresh scenario so no earlier modifier applies.
- A `min 1` modifier floors a spend of 1 at 1, so every `on turnEnd { spend side 1 }` is safe whether the turn's
  modifiers expire before or after the trigger fires.
- `cardPlayed` fires after each play by either side (or only one side's, with a `by` filter), never for an opening card. `turnEnd` fires once.
- A side's card draws from its own Contingency deck, or from the rival's where its design says so; a neutral card draws from the deck of the side that played it.
- Every card gets a test that plays it from a scenario fixture with one assertion per branch (content rules).

Shape tags used in the era files: **Opener** (Ops 1, tempo event for the secret pick), **Hot** (big Ops, strongly
one-sided event: the rival-card dilemma), **Hold** (pays again at turn end: play it when you can finish the turn),
**Tempo** (changes Ops this turn), **Swing** (points to both or Ops to both), **Gamble** (Contingency draw with a
real downside), **Split** (a yes/no choice for the named side), **Plain** (points, no choice).

## Designing for the rival-card dilemma

Counts in this section are the plan's, from before the owner removed 18 cards; the removed cards are no longer named.

- Hot cards (play for Ops, hate the event): the five Ops 4 cards (Desert Storm, Hong Kong Handover, Big Bang
  Enlargement, Olympic Summer 2008, Full-Scale Invasion) and the Ops 3 one-siders (Second Chechen
  War, Invasion of Iraq, Crimea, Belt and Road, Syrian Intervention, Chip Chokepoint). A rival holding one
  must weigh 3-4 Ops now against 2-3 points and a modifier for the other side.
- Hold cards (pay again at turn end, so play them while the turn is young): Mogadishu, Shanghai Five,
  Euro Cash, Petrocaribe, IPCC, Natanz, Crimea, Syria, AUKUS, Private Constellation, Migration 2015.
  Some hand the _rival_ the turn-end point (Petrocaribe): good now, a cost later, the "hold or dump" decision.
- Early cards / openers (event only, best as the secret opening pick): Primakov, Al Jazeera, ISS, Article 5,
  Montes, Munich Speech, September 11, Fall of Kabul, Neptune Spear.
- Gambles with a real downside: 16 cards draw a Contingency card and 15 of them can score for the rival.
- Splits that divide the sides: 38 cards ask a yes/no; 11 ask both sides at once (Asian crisis, Test Ban, Kyoto,
  SARS, Arab Spring, COVID-19 and others), where the stag-hunt shape of the Test Ban Treaty is the purest.
- Two splits are flavour only because one answer dominates: Partnership for Peace (SAE should join) and Ghost
  Stories (the trade is symmetric). Kept for history and marked for the owner (Owner question 19). Owner, 21 Oct:
  Ghost Stories' two answers now differ (a look at SAE's hand vs. SAE losing a card at random), built in R12d.

## Theme coverage (brief's list)

| Theme                    | Cards (era)                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Cyber                    | Golden Shield (1), Estonian Cyberattacks (2), Stuxnet (3)                                                                                     |
| Information warfare      | Al Jazeera, Belgrade Embassy (1), Curveball, Abu Ghraib, Munich Speech (2), The Leaks (3)                                                     |
| Energy and supply chains | Petrocaribe, Oil at $147, China in the WTO (2), Rare Earth, Belt and Road, Chips, Tariff Shock, Eurozone (3)                                  |
| Sanctions and finance    | Asian Crisis, Ruble, Shock Therapy (1), Euro Cash, Sovereign Wealth Funds (2), GFC, Parallel Plumbing (3)                                     |
| Pandemics                | SARS, PEPFAR (2), COVID-19 (3)                                                                                                                |
| Climate                  | Kyoto (1), IPCC 2007 (2), Paris Agreement (3), Heat Dome (future)                                                                             |
| AI and technology        | Dot-com (1), Smartphones (2), AI Compute Race, Chips (3), Open-Weight Leak (future)                                                           |
| Space                    | ISS (1), Anti-Satellite Test (2), Private Constellation (3)                                                                                   |
| Migration                | Migration Crises (3): Europe 2015 and Venezuela; see Owner question 21                                                                        |
| Populism and elections   | Chechen War (1), Cedar (2), Arab Spring, Populist Wave (3)                                                                                    |
| Proxy wars               | Desert Storm, Mogadishu, Oslo (1), Iraq (2), Syria, Assad, Kabul, Neptune Spear (3)                                                           |
| Alliances                | Maastricht, NATO 1999, PfP, Shanghai Five, Budapest (1), Article 5, Big Bang, India deal, Peace Mission (2), Nordic, AUKUS, Invasion (3)      |
| Gray-zone                | Taiwan Strait, Hainan, Pristina, Ames, Hanssen, Cox (1), Litvinenko, Montes (2), Crimea, Ghost Stories, HK Security Law, Cable Cut (3/future) |

## Engine wish list (ranked by cards unlocked)

Each code appears on the cards whose design layer needs it. Nothing here is built in stage 1; the playable layer
works without it.

| Rank | Code    | Missing mechanic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Cards it would unlock                                                                                                                                           |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | W1 + W3 | A marker that lasts beyond the turn and a Condition that tests it (`{ op: "has", marker }`), so a later card can read a tag an earlier card set (Budapest -> Crimea, Natanz -> Stuxnet, Hong Kong Handover -> Security Law). Built (#141, #142). Owner, 21 Oct (#202): eight tags are lasting, each keeping the label its card already records: "union founded" (Maastricht), "hollow assurance" (Budapest, the "no" branch only), "intervention fatigue" (Mogadishu), "one country, two systems" (Hong Kong Handover), "coalition fractures" (Invasion of Iraq), "programme revealed" (Natanz), "precedent set" (Kosovo) and "proxy war" (Syrian Intervention; the design's "foothold" is this same tag). Ten cards read them: Rwandan Genocide (built, R11a), Euro Cash, Big Bang, Curveball, Abu Ghraib (R11b), Stuxnet, Crimea, Migration Crises, HK Security Law, Fall of Assad (R11c). Cards only read a tag: nothing removes or closes one (Security Law and Assad's fall do not). Tags no card reads stay one-turn markers. The Iran deal card was cut, so only Stuxnet reads "programme revealed" | about 35 (every card marked W1 or W3)                                                                                                                           |
| 2    | W4      | Contingency draws for neutral cards (and a draw from the rival's deck). Both parts decided (owner, 21 Oct)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | neutral draws on twelve cards (#200 and its Era 2 and Era 3 tasks); rival draws on NATO Enlargement 1999, Cedar Revolution, Pristina Airport Dash and Curveball |
| 3    | W5      | A Condition on who played the card (so a rival-played hot card can bite differently). Built (R6, `playedBy`). Owner, 21 Oct: when the rival plays one of 10 hot cards (for points or as its opening pick), the card's side gets 1 less: the extra Ops change or turn-end point goes, or the main points drop by 1 (Desert Storm, Hong Kong Handover, Second Chechen War, Big Bang, Invasion of Iraq, Olympic Summer 2008, Crimea, Belt and Road, Syrian Intervention, Full-Scale Invasion). Chip Chokepoint is unchanged. Where a card also reads a lasting tag (#202), the tag version is worked out first, then the rival cut applies; setting cards record their tag whoever plays them. Cards follow in R12b-c                                                                                                                                                                                                                                                                                                                                                                                         | the 11 hot cards; also the two Notion originals that wrote "if the player was X"                                                                                |
| 4    | W8      | A step that discards from, or peeks at, a hand. Built (R6, `revealHand`, `discardFromHand`). Owner, 21 Oct: Ames, Hanssen and The Leaks show the rival's hand; Ghost Stories' trade shows SAE's hand and its jail makes SAE discard 1 card at random; Cox Report and Ana Montes are unchanged; no card lets a side pick from the rival's hand. Cards follow in R12d-e                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 6 espionage cards (Ames, Hanssen, Cox, Montes, Ghost Stories, The Leaks)                                                                                        |
| 5    | W2      | A trigger scoped to one side's plays, or that fires once. Built (R7, trigger `filter` and `once`). Owner, 21 Oct: Golden Shield and The Leaks score only after LIO's plays; Dot-com Boom still scores after either side's. Cards follow in R12e                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 3 cardPlayed cards (Dot-com, Golden Shield, The Leaks); they fire for both sides until R12e is built                                                            |
| 6    | W6      | Remove-from-game / `flags`: built (R8a added `flags.removeAfterEvent`; R13 made the five Ops 4 cards once-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | the 5 Ops 4 cards (once-only events)                                                                                                                            |
| -    | W7      | Map, influence, tension track, scoring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | every card; a rules decision for the owner, not an engine request                                                                                               |

## Cut from Notion (rows left at "Idea")

| Notion row                                                                                       | Why                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| "Contract of the Century" (BTC Pipeline)                                                         | Dated 2005-06 (Era 2 by the owner's own open point); low hook; Shale and Gas Cutoff covered energy (both since removed by the owner) |
| RTLM                                                                                             | Folded into Rwandan Genocide                                                                                                         |
| 2000 US Election (Bush v. Gore)                                                                  | Folded into Populist Wave (Era 3)                                                                                                    |
| Oklahoma City Bombing                                                                            | Domestic terrorism with no LIO/SAE angle; tone                                                                                       |
| 5G & Huawei Ban                                                                                  | Folded into Chip Chokepoint                                                                                                          |
| Oreshnik & New START, Prague Reset & New START, INF & Open Skies                                 | Merged into one neutral "Arms Control Unravels", since removed by the owner                                                          |
| Prompt Global Strike & X-37B                                                                     | Low hook; Hypersonics covers the arms race                                                                                           |
| Sri Lanka & Zambia defaults                                                                      | Folded into Belt and Road                                                                                                            |
| JCPOA & Max Pressure                                                                             | Folded into Iran: SWIFT Cutoff and the Deal, since removed by the owner                                                              |
| Nord Stream & LNG                                                                                | Blame for the 2022 pipeline sabotage is contested; Gas Cutoff and Shale covered the theme (both since removed by the owner)          |
| Sochi & Doping, "No Limits" Olympics / Sportswashing, 2008 Beijing Olympics (as a separate card) | Three Olympics cards overlap; Beijing 2008 survives inside Olympic Summer 2008                                                       |
| First BRIC Summit                                                                                | Folded into Parallel Plumbing                                                                                                        |
| WikiLeaks Cablegate, Snowden/PRISM                                                               | Merged into The Leaks (the Snowden row is the one updated)                                                                           |
| Jan 6, Brexit (as SAE cards)                                                                     | Merged into neutral Populist Wave (the Brexit row is the one updated)                                                                |
| RCEP                                                                                             | Low hook; Belt and Road and Parallel Plumbing cover it                                                                               |
| Oct 7 & Gaza                                                                                     | Omitted for tone at first; added by the owner as neutral e3-neu-009 (Owner question 14)                                              |
| Fukushima, Yellow Vests, Pegasus                                                                 | Low LIO/SAE angle; cut to make room                                                                                                  |
| Return of Trump, TPP & Section 301                                                               | Folded into Tariff Shock (roles only)                                                                                                |

## Owner questions

Each is a question, an assumption I made to carry on, or a conflict I found. Where the owner has answered, the
answer follows the question as **Answered**.

1. **Neutral Contingency draws.** The card schema's `foreignDraws` check forbids a neutral card drawing a
   Contingency card ("neutral events have no Contingency deck yet"), but core-loop.md and contingency-deck.md
   (decision 17) say a neutral event draws from the deck of the side that played it. I did not loosen the schema;
   all 22 neutral cards use choices instead of draws. Should the schema follow decision 17?
   **Answered:** yes, allow it; the schema change is its own task after this pull request.
   **Done** in #126. Redesigning neutral cards to draw is a follow-up pull request (owner, 19 Oct).
2. **Cross-deck draws.** A side's card may draw only from its own deck. Several gambles would read better drawing
   from the rival's deck (the rival's luck). Designed around; worth allowing?
   **Answered:** allow it later, as a separate engine task; the cards stay as built until then.
   **Done** in #124. Redesigning cards to draw from the rival's deck is a follow-up pull request (owner, 19 Oct).
   **Decided** (owner, 21 Oct, #201): the side that chooses to take the gamble draws from its own deck. NATO
   Enlargement 1999, Cedar Revolution, Pristina Airport Dash and Curveball now draw from the deck of the rival that
   chooses the gamble; every other gamble keeps its own. Whose bonuses apply to a draw from the rival's deck stays open.
3. **`flags` and the card skill.** `.claude/skills/card/SKILL.md` mentions `flags` and `schema/steps.ts`; the
   schema has neither (`flags` removed until the rules that use them arrive). The skill looks out of date; I did
   not edit `.claude/`.
   **Answered:** fix it, in its own small pull request.
4. **TEST scenario placeholders.** TURNS = 4, PLAYS_PER_TURN = 1 (dev fixture), eras entering on turns 2, 3 and 4,
   default Contingency decks. Please replace with your values; the deck size tolerates a wide range.
   **Answered:** keep the placeholders until the map and scoring exist.
5. **Stopgap reading.** Strict (cards at the start) or cumulative (all eras)? With the 6/2/3 deal (question 27)
   each side holds 8 non-neutral cards, which meets strict at 4 x 2 exactly.
   **Answered:** decide together with the hand-refill rules (question 27); the strict stopgap stays until then.
   Question 27 is now answered (refill to 8 each turn), so the stopgap goes once refilling is built.
   **Done:** hands refill at every turn start, so neither reading is needed and the stopgap is gone (core-loop.md,
   "Refilling hands").
6. **Era names.** eras.md leaves them undecided. The JSON will use `era-1`, `era-2`, `era-3` and `future`.
   **Answered:** keep the plain labels; display names can come later.
7. **Rules-text verb for `spendPoints`.** The step only records a `pointsSpent` event today. I write "LIO spends
   2 points". If the rules later make this influence or tension, every rules text changes with it.
   **Answered:** keep "spends points" until points have a designed use; then reword every card in one pass. Questions 19, 28, 44, 45 and 46 are revisited at the same time.
8. **Notion rows in the trash.** Eighteen of the original rows I planned to update are in the Notion trash and
   cannot be edited (Notion refuses: "This page is in the trash"). I did not restore them, since that would undo
   something you did. Instead each got a fresh Draft row with the new content; the era files name both ids
   ("recreated ... original row ... in the Notion trash"). Era 1: Dayton, NAFTA and the WTO, Kosovo Air Campaign,
   GPS Signal Opened, Peso Bailout, Pokhran and Chagai. Era 2: Jawbreaker, Colour Revolutions, Banco Delta Asia,
   Gas Cutoff, Argentine Default. Era 3: Iran: SWIFT Cutoff and the Deal, Shale Revolution, Sanctions Wall,
   Pre-bunking, Salisbury and the Sleuths, Sandworm, Arms Control Unravels. If you meant those cards to be gone,
   delete the new rows and tell me; if not, you can empty the trash. Twelve more rows fetch as deleted but
   accepted updates; I left them as live.
   **Answered:** the trash was deliberate; these events are not well known or significant enough. All 18 cards
   were removed from the deck, their numbers stay unused, and the fresh Draft rows were trashed too.
9. **Row count.** One query returned 93 rows, the full fetch 92. I worked from 92.
10. **Spy arrests moved to LIO.** Ames (Era 1), Montes (Era 2) and Ghost Stories (Era 3) are now LIO cards (the
    arrest is LIO's win); Hanssen stays SAE (the leak is the event). Montes spied for Cuba, not for Russia or China:
    keep her as an LIO counter-intelligence card or swap for another case?
    **Answered:** keep Montes.
11. **9/11 and the 2008 crash.** Both are cards (neutral Ops 1 September 11; SAE Ops 2 Global Financial Crisis)
    and both open an era. If you prefer era-opening events instead, cut them and those era counts drop by one.
    **Answered:** keep both as cards.
12. **Real names, legal.** Living people named in text: Putin, Snowden, Assad, Ames, Montes. Also named: Hariri (killed 2005), Litvinenko (died 2006), Hanssen (died 2023), Primakov (died 2015). Companies:
    Huawei, SpaceX/Starlink, Netscape, Apple, Nvidia, DeepSeek, COSCO, Citigroup, Morgan Stanley, Lehman Brothers,
    WikiLeaks. All in [name-swap.md](name-swap.md) with replacements. The owner chose to keep the Huawei mention in
    Chip Chokepoint and the Sri Lanka (Hambantota) mention in Belt and Road.
    **Answered:** keep the real names during development; check them against name-swap.md before release.
13. **Olympics.** Three overlapping Notion cards became one (Olympic Summer 2008). Sportswashing as a theme is gone.
14. **Oct 7 and Gaza.** Omitted for tone. Say so if you want it, and whether as neutral.
    **Answered:** add it as a neutral card. Its design (era, Ops, effect, text) is drafted for the owner's
    approval first and built only once approved. **Approved and built:** e3-neu-009 "October 7 and Gaza", Era 3,
    Ops 2: each side chooses whether to press for a ceasefire (the owner picked this over a version with no choice).
15. **Populist Wave (Brexit + Jan 6) as neutral.** The card lets SAE "amplify online" and never scores voters'
    choices themselves. Is that neutral enough, or should Brexit and Jan 6 stay apart or stay out?
    **Answered:** keep one card and widen it: the history note now also covers Italy's populist coalition (2018)
    and the storming of Brazil's seats of power (8 January 2023). The effect is unchanged.
16. **`cardPlayed` fires for both sides' plays.** Dot-com, Golden Shield and The Leaks score after every card this
    turn, including the rival's. The rules text says so. OK, or wait for W2?
    **Answered:** keep them as they are; revisit their wording when W2 is built.
    **Answered again (21 Oct), W2 built:** Golden Shield and The Leaks count LIO's plays only; Dot-com Boom still
    counts either side's (R12e).
17. **Ops 4 cards.** Five exist (one per side per era, except Era 3 LIO, whose Ops 4 card was removed). Is 4 the
    cap you want? No card has Ops 0.
    **Answered:** keep the cap at 4; the missing Era 3 LIO Ops 4 card is a balance question for later.
18. **Future cards.** Six roles-only 2025-2027 cards are designed (era-3.md). Build them in stage 4 or not?
    **Answered:** keep them; they were built in stage 4 and stay in the deck.
19. **Flavour-only choices.** Partnership for Peace and Ghost Stories have a dominant answer. Keep or sharpen?
    **Answered:** keep them for now; look again once points have a designed use (question 7).
    **Answered again for Ghost Stories (owner, 21 Oct):** its two answers now differ: the trade shows SAE's hand to
    LIO, the jail makes SAE discard 1 card at random (R12d). Partnership for Peace is unchanged.
20. **Softened facts.** Where a search could not confirm a detail I softened it: ISS Expedition 1 "November 2000";
    Georgia ceasefire "brokered by France" without a date; no Facebook date; no Avangard; Baltic cable damage
    "late 2024"; rare earth "reported halt ... disputed"; Nvidia "nearly $600 billion"; Russian 1992 inflation not
    quantified.
    **Answered:** accept the softened wording; fact-check every history note once before release.
21. **Migration is thin.** One card (Migration Crisis 2015). A second (the 2021 Belarus border crisis, SAE, Era 3)
    could be added to Era 3 (now 8 LIO, 12 SAE, 7 neutral). Want it?
    **Answered:** no Belarus card; the one card becomes Migration Crises and its history note adds Venezuela's
    exodus. The effect is unchanged.
22. **Side assignments that may read as judgement.** Mogadishu, Fall of Kabul, Abu Ghraib and Invasion of Iraq are
    SAE cards because the events hurt LIO, not because SAE caused them; same logic for Rwanda being neutral. OK?
    **Answered:** keep the sides as they are.
23. **Taiwan Strait, Hainan, Pristina: LIO chooses on an SAE card.** The rival decides the branch of your card.
    This is deliberate (the card forces the other side's hand) but it is a design taste; confirm.
    **Answered:** keep it.
24. **Gambles assume 1-6 decks.** Thresholds (d >= 3 is 4 in 6; d >= 4 is 3 in 6; d <= 2 is 2 in 6; d >= 2 is
    5 in 6) assume the default decks. A scenario with other decks changes every gamble's odds.
    **Answered:** keep the 1-6 decks fixed for every scenario.
25. **Modifier and trigger order at turn end.** I could not confirm whether a `turnEnd` modifier expires before or
    after a `turnEnd` trigger fires; every turn-end spend here is 1 under a `min 1` floor, so it does not matter
    today. A builder adding a turn-end spend of 2 must check.
    **Checked in the engine:** `turnEnd` triggers fire and finish while the turn's modifiers still apply; the
    modifiers are removed afterwards, when the turn ends (`packages/engine/src/turn.ts`, `settle` and `endTurn`).
26. **Neutral events cannot run yet.** The engine plays a neutral card for points only (marked TEMPORARY in
    `packages/engine/src/decisions.ts`) and excludes neutral cards from opening picks, while core-loop.md says neutral
    cards have events and can open. All 22 neutral cards are built with their intended effect, but in a game they
    only ever give points. Lift the engine rule when you are ready; no card needs to change.
    **Answered:** lift it next, as an engine task after this pull request.
    **Done:** the engine now lets a neutral card be played for its event or its points, and lets it be an opening
    pick, where it resolves as its event (core-loop.md). The card tests no longer pretend a neutral card is LIO's.
27. **Hands never refill, so the deal is a stopgap.** The plan's HAND_SIZE of 7 cannot work: each side must hold at
    least turns x (1 + plays per turn) non-neutral cards for the whole game. The AI game deals 22 of the 28 Era 1
    cards: each side gets 6 of its own, 2 of the rival's and 3 neutral ones (11); the other 6 (5 SAE, 1 neutral)
    go to the draw pile, like the later eras' cards. Cards in the draw pile are never played. Confirm the intended
    hand and deal rules.
    **Answered:** at the start of each turn both sides refill their hands to 8 cards from one shared draw pile
    (any side's cards); when the pile runs out, the discards are shuffled into a new one. This is a separate task:
    the rule goes into the Notion "Core loop" page and core-loop.md first, then the engine. The current deal and
    the strict stopgap (question 5) stay until then.
    **Done:** the engine refills both hands at every turn start, after a new era's cards enter and before the
    opening picks, LIO first; the turn 1 refill deals the first hands. Hand size is the scenario's `handSize`
    (8 in `first-deck-test`). The practice game no longer deals: all 28 Era 1 cards start in the draw pile.
28. **Ops swings affect all points spent.** The engine's modifier changes every point spent, not only points from
    "play for points". The plan's wording was changed to "points spent by <side> count N more". OK, or should the
    engine tell the two apart?
    **Answered:** keep it; revisit when points have a designed use (question 7).
29. **The schema cannot list Era 1 in a scenario's `eras`.** `eras` names only later eras and each needs at least one
    card. The TEST scenario `first-deck-test` therefore has no `eras`; all Era 1 cards are dealt by the game setup.
30. **TEST scenario numbers are placeholders.** 4 turns, 1 play per turn (needs 8 non-neutral cards per side;
    the deal gives 8). It was 6 turns until the owner's removal left LIO with only 8 Era 1 cards. Please set the
    real numbers. **Answered:** set the real turn count and era arrival turns together with hand refills (question 27), in the Core loop page first; the placeholders stay until then.
31. **The app reaches the real cards through the host.** The app may not import content, so
    `packages/host/src/firstDeck.ts` (exported as `@terminal-dusk/host/first-deck`) holds the seeded deal and card
    names. Two new package subpath exports were added (content `./first-deck`, host `./first-deck`) so that the
    existing "exports nothing else yet" tests stay as they are. Confirm this route, or say where the deal should live. **Answered:** keep this route.
32. **The deal comes from the game seed.** It is a plain function of the seed in the local practice game, so the
    hands are derivable by anyone who knows the seed. Fine for practice against the AI; an online game must deal on
    the server. **Answered:** fine for practice; online games deal on the server.
33. **Commit trailer model name.** The task said "Claude Opus 5.5"; a system reminder said "Claude Sonnet 5.5". The
    task text was followed. Please correct if needed. **Resolved:** the session's own attribution line also names Claude Opus 5.5, so the trailer stands.
34. **Era 2 cards never reach a hand in the practice game.** Era 2 enters through the TEST scenario's `eras` entry
    (turn 2), so its 29 cards are shuffled into the draw pile then. The engine never moves cards from the draw pile
    into hands, so in the AI game no Era 2 card is ever played. The cards are built, tested and loaded; they will
    appear in games once the rules say how hands refill (see question 27). **Answered by question 27:** fixed when hand refills are built.
    **Done:** hands now refill each turn, so Era 2 cards are drawn and played.
35. **A "count more" bonus also hits a turn-end spend (SARS).** At the end of a turn the turn-end triggers fire
    before the Ops swings expire. If both sides say no to the SARS card, the penalty each side pays at turn end is
    spent while the other side's "+1" is still in force, so it counts 2 instead of 1. The plan's "never below 1"
    safety note does not cover this. Built as the engine behaves; please say if the penalty should stay 1. **Answered:** keep it at 2 (a joint cover-up costs both more). The rules text now says so.
36. **Several turn-end triggers are logged before any of them spends.** When two turn-end triggers are waiting, the
    engine records both as fired and then runs their spends. This only changes the order of the history log, not the
    result. SARS (both say no) shows it.
37. **Era 2 test scenario is still a test.** Era 2 enters at turn 2 of the placeholder 4-turn scenario purely to
    exercise the `eras` setup; the real turn of entry depends on the unresolved turn count (question 30). **Answered:** set with the turn count (question 30).
38. **Future cards enter on turn 4.** The plan names the era string `future` but no turn. They enter the TEST scenario
    on turn 4 (the last of the placeholder 4) in their own `eras` entry and live in `cards/future/` with ids `ef-...`.
    Say where they should really go, or whether they should be built at all (question 18). **Answered:** keep them (question 18); the arrival turn is set with the turn count (question 30).
39. **Era 3 enters on turn 3.** A placeholder like Era 2's turn 2 (question 37). **Answered:** set with the turn count (question 30).
40. **Ruleset size.** The first-deck ruleset now holds 91 cards, future cards included (90 until the owner added October 7 and Gaza, question 14). An owner who drops the optional
    cards removes `futureFiles.ts`, its `eras` entry and one line in `firstDeckRules.ts`; nothing else depends on them.
41. **Era 3 cards still dormant in the AI game.** Same cause as question 34: hands never refill, so no Era 3 or future
    card is ever played in the practice game. They are built, tested and loaded. **Answered by question 27:** fixed when hand refills are built.
    **Done:** hands now refill each turn, so Era 3 and future cards are drawn and played.
42. **Test-writing method.** The Era 3 and future tests take their expected results from the engine's real output,
    checked by hand against the Playable line, rather than being written out by hand first as in Era 2. Say if you want
    them rewritten the Era 2 way. **Answered:** keep them as they are.
43. **Commit trailer.** This stage's commit ends with the model line the task asked for (Claude Opus 5.5); the session
    was reminded of a different model name. See question 33.
44. **Choices with one clearly better answer (stage 5 review).** Played as a player would, these yes/no choices have
    an answer that is never worse for the chooser, so they are not real decisions. Each matches its approved Design
    line, so the cards were left as designed (changing payoffs is a design choice). Suggested fixes use existing steps:
    Budapest Memorandum (SAE: yes gives SAE 1, no gives LIO 1; add `mod sae -1 min 1 (turn)` to yes);
    NATO Enlargement 1999 (SAE: a failed protest costs the same as no protest; make the failed branch `spend lio 2`);
    Oslo Accords (SAE: yes adds SAE 1 on top of the same LIO 1; add `mod sae -1 min 1 (turn)` to yes);
    AI Compute Race (LIO: yes gives LIO 1 more and SAE the same 1; make no `spend sae 2` or give yes a cost);
    Tariff Shock (SAE: no gives SAE 1 at turn end with no penalty, yes gives SAE 1 now plus a -1; give no a cost or
    drop the penalty); Populist Wave (SAE: yes gives SAE 1 and LIO 1 less, no gives LIO 1; one-sided by design?).
    Question 19 already covers Partnership for Peace and Ghost Stories. **Answered:** revisit all of these with question 7; the cards stay as designed until then.
45. **"Both get 1" choices.** Shock Therapy Backlash, China in the WTO, Litvinenko, Parallel Plumbing and the Hong Kong security
    law give both sides 1 point on one answer. Whether that is a real choice depends on what points are for
    (question 7): if only the gap between the sides counts, these answers change nothing. **Answered:** decide with question 7.
46. **Test Ban Treaty as a stag hunt.** If only the gap between the sides' points counts, saying no is always best for
    both sides, so the card is not a stag hunt; it is one only if each side's own total matters. Same open point as 45. **Answered:** decide with question 7.
47. **Names close to another game.** "Test Ban Treaty" and "Arrest of Aldrich Ames" are real historical names, not
    copied titles or wording, but another well-known Cold War card game has cards on the same two subjects. Kept
    as planned. The name swap list already has neutral titles for both if you would rather be safe. **Answered:** keep them; check both in the pre-release name check (question 12).
48. **Belt and Road wording.** The LIO question "Expose the debt traps?" uses one side's framing of a disputed claim.
    The rules text has to match the plan, so it was kept; a neutral wording would be "Challenge the loan terms?". **Answered:** use "Challenge the loan terms?"; changed in era-3.md and the card.
49. **One wording for "both sides" Ops changes.** Five cards said "points spent by both sides count 1 more" and two
    said "either side" for the same step. All seven now say "either side" (Era 1's wording). The plan's template list
    has no line for this case; please confirm the wording. **Answered:** keep "either side".
50. **Future cards' plan lines.** The six future cards use a combined "Design/Playable:" line in era-3.md rather than
    separate lines. Their JSON matches it; noted so a tool that reads "Playable:" lines does not miss them.
