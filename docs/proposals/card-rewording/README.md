Proposal, not a rule

# Card rules text once points have a use: wording rules

Owner question 7 (`docs/design/cards/deck-plan.md`): keep "spends points" until points have a designed use, then
reword every card in one pass. That use is now decided (`docs/design/map-and-points.md`, "Event points"): a design
line such as "LIO 2" means LIO **spends 2 points on the action menu** (place influence, intervene, realign), as if
it had played an Ops 2 card for points. Sixteen cards also move Escalation by 1 ("Cards that move it").

This file holds the wording rules every card follows and the open points that change many cards at once. The
drafts are in one file per era:

- [era-1.md](era-1.md): the 29 Era 1 cards (X10a)
- [era-2.md](era-2.md): the Era 2 cards (X10b)
- [era-3.md](era-3.md): the Era 3 and future cards (X10c)

Nothing here is built or decided. Each draft waits for the owner's approval; once approved, its wording moves into
the card's JSON and its era file. No card's effect changes except what `docs/design/` already decides: where the
points go (the action menu) and the Escalation moves. Every other step, number and choice stays as it is.

## Wording rules

The rules text still says exactly what the card's JSON does, one sentence per step, in step order, using
deck-plan.md's "Rules-text templates". Only the templates below change or are new.

### 1. A `spend` step

- **Today:** `spend lio 2` reads _LIO spends 2 points._
- **Draft:** _LIO spends 2 points on actions._ ("1 point" when the amount is 1.)
- "Actions" is the action menu: place influence, intervene, realign (and the tech race, if the owner allows it for
  event points; open point **Tech** below). The word stays the same whatever the menu holds, so the menu can grow
  without rewording any card. A card always names the side that spends, never "you".
- Under open point **Split** the sentence may become _LIO spends 2 points on one action._ (alternatives below).
- An `opsValue` modifier in force still changes the amount, as today (deck-plan.md, "Facts every builder must know").
- **Worked example, Maastricht Treaty (e1-lio-001).** Today: Record "union founded" for the rest of the game. LIO
  spends 1 point. Until the end of this turn, points spent by LIO count 1 more. Draft: Record "union founded" for the
  rest of the game. **LIO spends 1 point on actions.** Until the end of this turn, points spent by LIO count 1 more.

### 2. A card that raises or lowers Escalation by 1

- **Provisional design-line notation:** `escalate +1` and `escalate -1`. R18 builds the real step and picks its
  JSON; until then the notation only marks where the move sits in the card's steps.
- **Template:** `escalate +1` reads _Raise Escalation by 1._; `escalate -1` reads _Lower Escalation by 1._
- The card does not repeat the track's rules: the track stops at 0 and 6, a level of 3, 4 or 5 closes regions, and
  6 is a crisis caused by the player who played the card (map-and-points.md, "Escalation").
- **Where the move sits:** every draft puts it as the **last step** of the effect, after every `spend`, `ask`,
  `draw` and `mod` step, outside any choice (option P2 with B1 in question 1 below). The one exception is decided
  in docs/design/: Test Ban Treaty lowers Escalation only if both sides ratify, so its move is the last step of that
  branch. Each Escalation card's entry names the placement it uses.
- **Worked example, Second Chechen War (e1-sae-004).** Design line: `marker "consolidation"; if played lio { spend sae 2 } else { spend sae 3 }; escalate +1`.
  Draft: Record "consolidation". If LIO played this card, SAE spends 2 points on actions; otherwise, SAE spends 3
  points on actions. **Raise Escalation by 1.**

### 3. A rival card's points and a neutral card's points

The rules of `docs/design/core-loop.md` ("Playing a card") do not change, and card text does not mention them.
A card's text names the side that spends; that side spends, whoever played the card.

- **Rival card, worked example: SAE plays Desert Storm Coalition (e1-lio-006, LIO, Ops 4) for its points.** SAE
  spends 4 points on actions. Before or after that (SAE's choice) the event runs as LIO's: record "coalition
  victory"; LIO spends 3 points on actions; "If LIO played this card" is false, so SAE's points are not cut; raise
  Escalation by 1. If that raise reaches 6, SAE caused the crisis, because SAE played the card.
- **Neutral card, worked example: Ruble Default (e1-neu-003, neutral, Ops 2).** Played for its points, the player
  spends 2 points on actions and there is no event. Played for its event (or as an opening pick), the text runs as
  written: SAE chooses whether to default; on yes, the draw comes from the deck of the side that played the card
  and SAE spends 2 points on actions on 3 or more; on no, LIO spends 1 point on actions.

### 4. A `mod` step (Ops swings)

- **As the card JSON says it today:** `mod lio +1 (turn)` reads _Until the end of this turn, points spent by LIO
  count 1 more._; `mod sae -1 min 1 (turn)` reads _Until the end of this turn, points spent by SAE count 1 less,
  never below 1._; `side both` reads _points spent by either side_ (owner question 49). deck-plan.md's line "LIO's
  plays for points are worth 1 more until the end of the turn" is out of date (era-1.md, "Stage 2 build notes").
- **Reading A of owner question 28 (every point spent, as the engine does today):** the wording above stays, or
  takes the clearer form **Q28-A-clear**: _Until the end of this turn, each time LIO spends points, it spends 1
  more._ / _... 1 fewer, never below 1._ (The engine adds 1 to each spend, not to each point; today's words could be
  read as "each point counts double".)
- **Reading B (only cards played for points):** **Q28-B**: _Until the end of this turn, cards LIO plays for points
  give 1 more point._ / _... give 1 point fewer, never below 1._ / _cards either side plays for points ..._. Reading
  B needs an engine change (the `opsValue` hook would have to tell the two kinds of spend apart).

## Open points and their alternative wordings

Each has a short name. Card entries name it instead of repeating the wordings. None is decided.

- **Split** (map-and-points.md, "Points and actions", point 1: whether all points go to one action or can be split).
  - **Split-any:** _LIO spends 2 points on actions._ (any mix of placing, intervening and realigning)
  - **Split-one:** _LIO spends 2 points on one action._ (all on placing influence, or all on one intervention, or
    all on realigning). For 1 point the two read the same, so only spends of 2 or more change.
- **Turn-end** ("Event points": how a 1-point turn-end payment is spent). Applies to `on turnEnd { spend side 1 }`.
  - **Turn-end-any:** _At the end of this turn, LIO spends 1 point on actions._
  - **Turn-end-place:** _At the end of this turn, LIO spends 1 point placing influence._
  - The amount can be 2 when an Ops swing is still in force at turn end (owner question 35); the wording holds.
  - `on cardPlayed` spends (Dot-com Boom, Golden Shield) happen during the turn, not at its end, so they use the
    ordinary template.
- **Tech** ("Event points", open in the tech race topic: whether event points may go to the tech race).
  - **Tech-yes** or no tech race yet: _on actions_, unchanged.
  - **Tech-no:** event spends read _LIO spends 2 points on map actions._ while a card played for points may still
    use the tech race.
- **Q28** (owner question 28): readings A, A-clear and B in wording rule 4. Applies to every `mod` step.
- **Place** (where an Escalation move sits): question 1 below. Applies to the cards that move Escalation.

**Scoring readings.** Scoring is not decided (map-and-points.md, "Scoring"). Owner questions 45 and 46 turn on
whether **only the gap** between the sides counts (reading **Gap**) or **each side's own total** matters (reading
**Own**). The era files give an option for each reading where the answer depends on it.

## Questions for the owner

1. **Place: where does a card's Escalation move sit in its steps?** docs/design/ says only that the sixteen cards
   move Escalation "on top of what each already does". It matters: a raise to 3, 4 or 5 closes a region to
   interventions and realignments, and a raise to 6 is a crisis, so a move before a spend changes what the points
   can do.
   - **P1, first:** the move comes before the card's spends. A raise can close a region before the card's own side
     spends there; a lower can open one.
   - **P2, last:** the move is the effect's last step. The card's points are spent on the map as the player found
     it; the move is the event's after-effect.
   - **P3, in the spend's favour:** a lower comes first and a raise comes last, so a move never closes a region to
     the card's own points. Most generous to the card; two rules to learn instead of one.
   - **And which branch?** **B1:** outside every choice and draw (the move always happens), as "on top of what
     each already does" reads; the only decided exceptions are the two arms-control cards. **B2:** inside the
     branch that fits the story (for example, Taiwan Strait Crisis only if the carriers are sent).
   - **Recommend P2 with B1:** one rule for every card, the player sees the board it spends on, and B1 keeps to the
     words docs/design/ already has. Every draft uses it.
2. **Q28: does an Ops swing change every point spent, or only cards played for points?** Now that points place
   influence and pay for interventions, a +1 makes every event spend and every intervention 1 bigger.
   - **A:** keep (every spend); today's wording. **A-clear:** keep, with the clearer wording. **B:** plays for
     points only; an engine change.
   - **Recommend A-clear:** it is what the engine does and what the owner kept for SARS (question 35), and the new
     words remove the "counts double" misreading.
3. **Split: can a play's points be split between actions?** **Split-any** or **Split-one**.
   - Split-any is simpler to explain and gives the player more ways to use small amounts; Split-one is the
     reference game's rule, which the owner asked to follow for this topic, and makes each spend one clear move.
   - **Recommend Split-one**, as the owner's "same rules as the reference game" for topic 3.
4. **Turn-end: how is a 1-point turn-end payment spent?** **Turn-end-any** or **Turn-end-place**.
   - Turn-end-any is one sentence for every spend. But an intervention in a battleground raises Escalation however
     it turns out, so a 1-point intervention at turn end becomes a cheap way to push the track up just before it
     falls.
   - **Recommend Turn-end-place:** it removes that lever and is quick to play at the end of a turn.
5. **Tech: may event points go to the tech race?** **Tech-yes** or **Tech-no**. Waits on the tech race topic
   (X7). **Recommend** writing _on actions_ now, which needs no rewording if the answer is yes.
