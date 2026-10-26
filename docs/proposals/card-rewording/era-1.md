Proposal, not a rule

# Era 1 cards: rules text reworded now that points have a use

The 29 cards of `docs/design/cards/era-1.md`, in that file's order. Wording rules, open points and their
alternative wordings are in [README.md](README.md). Each entry gives today's rules text (from the card's JSON) and
the draft. **Open points** names the README open points the draft depends on; the draft is written in their first
alternative (Split-any, Turn-end-any, Tech-yes, Q28-A as today) and picks none of them. The seven cards that move
Escalation also get a draft Design and Playable line. Nothing else in any card's effect changes.

## LIO (9)

### e1-lio-001 · Maastricht Treaty

- **Today:** Record "union founded" for the rest of the game. LIO spends 1 point. Until the end of this turn, points spent by LIO count 1 more.
- **Draft:** Record "union founded" for the rest of the game. LIO spends 1 point on actions. Until the end of this turn, points spent by LIO count 1 more.
- **Open points:** Tech, Q28.

### e1-lio-002 · Budapest Memorandum

- **Today:** Record "assurances given". LIO spends 2 points. SAE chooses: Honour the assurances? If yes, record "promise kept", then SAE spends 1 point; if no, record "hollow assurance" for the rest of the game, then LIO spends 1 point.
- **Design (draft):** LIO 2; SAE chooses to honour the assurances (SAE 1, a "promise kept" tag) or treat them as paper (LIO 1 more now; a "hollow assurance" tag Crimea would cash in, W3). Either way Escalation -1: the arsenal is gone.
- **Playable (draft):** `marker "assurances given"; spend lio 2; ask sae "Honour the assurances?" -> v; if yes v { marker "promise kept"; spend sae 1 } else { marker "hollow assurance" lasting; spend lio 1 }; escalate -1`
- **Draft:** Record "assurances given". LIO spends 2 points on actions. SAE chooses: Honour the assurances? If yes, record "promise kept", then SAE spends 1 point on actions; if no, record "hollow assurance" for the rest of the game, then LIO spends 1 point on actions. Lower Escalation by 1.
- **Placement:** P2 with B1 (last step, outside the choice). **Open points:** Split, Tech, Place; owner question 44 below.

### e1-lio-004 · NATO Enlargement 1999

- **Today:** Record "enlargement". LIO spends 2 points. SAE chooses: Protest the enlargement? If yes, (draw from SAE's Contingency deck, then if the result is 4 or more, SAE spends 2 points; otherwise, LIO spends 1 point); if no, LIO spends 1 point.
- **Draft:** Record "enlargement". LIO spends 2 points on actions. SAE chooses: Protest the enlargement? If yes, (draw from SAE's Contingency deck, then if the result is 4 or more, SAE spends 2 points on actions; otherwise, LIO spends 1 point on actions); if no, LIO spends 1 point on actions.
- **Open points:** Split, Tech; owner question 44 below.

### e1-lio-006 · Desert Storm Coalition

- **Today:** Record "coalition victory". LIO spends 3 points. If LIO played this card, until the end of this turn, points spent by SAE count 1 less, never below 1. If this card's event happens, remove it from the game afterwards.
- **Design (draft):** LIO 3 and SAE -1 Ops this turn: the unipolar moment; Escalation +1. Hot: an SAE holder wants 4 Ops but hands LIO the event. If SAE plays it: LIO 3 only, no SAE -1 Ops; Escalation still +1, and a crisis it causes is SAE's.
- **Playable (draft):** `marker "coalition victory"; spend lio 3; if played lio { mod sae -1 min 1 (turn) }; escalate +1; once-only`
- **Draft:** Record "coalition victory". LIO spends 3 points on actions. If LIO played this card, until the end of this turn, points spent by SAE count 1 less, never below 1. Raise Escalation by 1. If this card's event happens, remove it from the game afterwards.
- **Placement:** P2 with B1 (last step, outside the "if played" test; the once-only flag is not a step). **Open points:** Split, Tech, Q28, Place.

### e1-lio-010 · Arrest of Aldrich Ames

- **Today:** Record "mole exposed". LIO spends 1 point. SAE's hand is shown to LIO. Draw from LIO's Contingency deck. If the result is 4 or more, LIO spends 1 point; otherwise, SAE spends 1 point.
- **Draft:** Record "mole exposed". LIO spends 1 point on actions. SAE's hand is shown to LIO. Draw from LIO's Contingency deck. If the result is 4 or more, LIO spends 1 point on actions; otherwise, SAE spends 1 point on actions.
- **Open points:** Tech.

### e1-lio-011 · Dot-com Boom

- **Today:** Record "network effect". LIO spends 1 point. After each later card played this turn, by either side, LIO spends 1 point.
- **Draft:** Record "network effect". LIO spends 1 point on actions. After each later card played this turn, by either side, LIO spends 1 point on actions.
- **Open points:** Tech. (Its later spends happen during the turn, so Turn-end does not apply.)

### e1-lio-012 · Partnership for Peace

- **Today:** Record "partners, not members". LIO spends 1 point. SAE chooses: Join the partnership? If yes, SAE spends 1 point; if no, until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Design (draft):** LIO 1; SAE may join (SAE 1, a "partner" tag) or stay out (SAE -1 Ops this turn as it isolates itself). Either way Escalation -1: old enemies sit at one table.
- **Playable (draft):** `marker "partners, not members"; spend lio 1; ask sae "Join the partnership?" -> v; if yes v { spend sae 1 } else { mod sae -1 min 1 (turn) }; escalate -1`
- **Draft:** Record "partners, not members". LIO spends 1 point on actions. SAE chooses: Join the partnership? If yes, SAE spends 1 point on actions; if no, until the end of this turn, points spent by SAE count 1 less, never below 1. Lower Escalation by 1.
- **Placement:** P2 with B1. **Open points:** Tech, Q28, Place; owner question 19 below.

### e1-lio-013 · Oslo Accords

- **Today:** Record "handshake". LIO spends 1 point. SAE chooses: Back the spoilers? If yes, SAE spends 1 point, then at the end of this turn, LIO spends 1 point; if no, LIO spends 1 point.
- **Design (draft):** LIO 1; SAE may back the spoilers (SAE 1 now, but LIO 1 at turn end as the broker rallies support) or stay out (LIO 1 more). Either way Escalation -1: the handshake itself calms the region.
- **Playable (draft):** `marker "handshake"; spend lio 1; ask sae "Back the spoilers?" -> v; if yes v { spend sae 1; on turnEnd { spend lio 1 } } else { spend lio 1 }; escalate -1`
- **Draft:** Record "handshake". LIO spends 1 point on actions. SAE chooses: Back the spoilers? If yes, SAE spends 1 point on actions, then at the end of this turn, LIO spends 1 point on actions; if no, LIO spends 1 point on actions. Lower Escalation by 1.
- **Placement:** P2 with B1. Under B2 the move would sit in the "no" branch only (spoilers backed, no calm). **Open points:** Turn-end, Tech, Place; owner question 44 below.

### e1-lio-014 · End of the Soviet Union

- **Today:** Record "red flag lowered". LIO spends 2 points. SAE chooses: Hold the new states in a commonwealth? If yes, SAE spends 1 point, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, at the end of this turn, LIO spends 1 point.
- **Draft:** Record "red flag lowered". LIO spends 2 points on actions. SAE chooses: Hold the new states in a commonwealth? If yes, SAE spends 1 point on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, at the end of this turn, LIO spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech, Q28.

## SAE (13)

### e1-sae-001 · Battle of Mogadishu

- **Today:** Record "intervention fatigue" for the rest of the game. SAE spends 1 point. At the end of this turn, SAE spends 1 point.
- **Draft:** Record "intervention fatigue" for the rest of the game. SAE spends 1 point on actions. At the end of this turn, SAE spends 1 point on actions.
- **Open points:** Turn-end, Tech.

### e1-sae-002 · Handover of Hong Kong

- **Today:** Record "one country, two systems" for the rest of the game. If LIO played this card, SAE spends 2 points; otherwise, SAE spends 3 points. If this card's event happens, remove it from the game afterwards.
- **Draft:** Record "one country, two systems" for the rest of the game. If LIO played this card, SAE spends 2 points on actions; otherwise, SAE spends 3 points on actions. If this card's event happens, remove it from the game afterwards.
- **Open points:** Split, Tech.

### e1-sae-003 · Golden Shield

- **Today:** Record "walled network". SAE spends 1 point. After each later card LIO plays this turn, SAE spends 1 point.
- **Draft:** Record "walled network". SAE spends 1 point on actions. After each later card LIO plays this turn, SAE spends 1 point on actions.
- **Open points:** Tech. (Its later spends happen during the turn, so Turn-end does not apply.)

### e1-sae-004 · Second Chechen War

- **Today:** Record "consolidation". If LIO played this card, SAE spends 2 points; otherwise, SAE spends 3 points.
- **Design (draft):** SAE 3: power consolidated. A "strongman" tag (W1). Escalation +1: a war on Russia's own soil. If LIO plays it: SAE 2 instead of 3; Escalation still +1, and a crisis it causes is LIO's.
- **Playable (draft):** `marker "consolidation"; if played lio { spend sae 2 } else { spend sae 3 }; escalate +1`
- **Draft:** Record "consolidation". If LIO played this card, SAE spends 2 points on actions; otherwise, SAE spends 3 points on actions. Raise Escalation by 1.
- **Placement:** P2 with B1 (last step, outside the "if played" test). **Open points:** Split, Tech, Place.

### e1-sae-005 · The Hanssen Leak

- **Today:** Record "mole inside". SAE spends 2 points. LIO's hand is shown to SAE. Draw from SAE's Contingency deck. If the result is 2 or less, record "mole caught", then LIO spends 1 point.
- **Draft:** Record "mole inside". SAE spends 2 points on actions. LIO's hand is shown to SAE. Draw from SAE's Contingency deck. If the result is 2 or less, record "mole caught", then LIO spends 1 point on actions.
- **Open points:** Split, Tech.

### e1-sae-006 · Shanghai Five

- **Today:** Record "entente formed". SAE spends 2 points. At the end of this turn, SAE spends 1 point.
- **Draft:** Record "entente formed". SAE spends 2 points on actions. At the end of this turn, SAE spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech.

### e1-sae-007 · Taiwan Strait Crisis

- **Today:** Record "strait crisis". LIO chooses: Send the carriers? If yes, LIO spends 2 points, then until the end of this turn, points spent by LIO count 1 less, never below 1; if no, SAE spends 3 points.
- **Design (draft):** LIO decides: send the carriers (LIO 2 but -1 Ops this turn, forces stretched) or stay out (SAE 3, intimidation works). Either way Escalation +1: missiles have already flown.
- **Playable (draft):** `marker "strait crisis"; ask lio "Send the carriers?" -> v; if yes v { spend lio 2; mod lio -1 min 1 (turn) } else { spend sae 3 }; escalate +1`
- **Draft:** Record "strait crisis". LIO chooses: Send the carriers? If yes, LIO spends 2 points on actions, then until the end of this turn, points spent by LIO count 1 less, never below 1; if no, SAE spends 3 points on actions. Raise Escalation by 1.
- **Placement:** P2 with B1. Under B2 the move would sit in the "yes" branch only (carriers sent). **Open points:** Split, Tech, Q28, Place.

### e1-sae-008 · Primakov's U-turn

- **Today:** Record "turn over the Atlantic". Until the end of this turn, points spent by LIO count 1 less, never below 1.
- **Draft:** unchanged: the card has no `spend` step and does not move Escalation. Its `mod` wording changes only under Q28-A-clear or Q28-B.
- **Open points:** Q28.

### e1-sae-009 · Belgrade Embassy Bombing

- **Today:** Record "embassy hit". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 3 points; otherwise, LIO spends 1 point.
- **Draft:** Record "embassy hit". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 3 points on actions; otherwise, LIO spends 1 point on actions.
- **Open points:** Split, Tech.

### e1-sae-010 · Hainan Island Incident

- **Today:** Record "collision". SAE spends 1 point. LIO chooses: Say sorry? If yes, LIO spends 1 point; if no, until the end of this turn, points spent by LIO count 1 more, then SAE spends 1 point.
- **Draft:** Record "collision". SAE spends 1 point on actions. LIO chooses: Say sorry? If yes, LIO spends 1 point on actions; if no, until the end of this turn, points spent by LIO count 1 more, then SAE spends 1 point on actions.
- **Open points:** Tech, Q28.

### e1-sae-011 · Pristina Airport Dash

- **Today:** Record "airport seized". SAE spends 1 point. LIO chooses: Confront them? If yes, (draw from LIO's Contingency deck, then if the result is 4 or more, LIO spends 2 points; otherwise, SAE spends 2 points); if no, record "stand-off avoided".
- **Draft:** Record "airport seized". SAE spends 1 point on actions. LIO chooses: Confront them? If yes, (draw from LIO's Contingency deck, then if the result is 4 or more, LIO spends 2 points on actions; otherwise, SAE spends 2 points on actions); if no, record "stand-off avoided".
- **Open points:** Split, Tech.

### e1-sae-012 · Shock Therapy Backlash

- **Today:** Record "reform backlash". SAE spends 2 points. LIO chooses: Fund the reformers? If yes, LIO spends 1 point, then at the end of this turn, SAE spends 1 point; if no, record "left to themselves".
- **Draft:** Record "reform backlash". SAE spends 2 points on actions. LIO chooses: Fund the reformers? If yes, LIO spends 1 point on actions, then at the end of this turn, SAE spends 1 point on actions; if no, record "left to themselves".
- **Open points:** Split, Turn-end, Tech; owner question 45 below.

### e1-sae-013 · Cox Report

- **Today:** Record "designs copied". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 2 points; otherwise, record "ring exposed", then LIO spends 1 point.
- **Draft:** Record "designs copied". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 2 points on actions; otherwise, record "ring exposed", then LIO spends 1 point on actions.
- **Open points:** Split, Tech.

## Neutral (7)

### e1-neu-001 · Rwandan Genocide

- **Today:** Record "the world looks away". If "intervention fatigue" has been recorded this game, until the end of this turn, points spent by LIO count 2 less and points spent by SAE count 1 less, never below 1; otherwise, until the end of this turn, points spent by either side count 1 less, never below 1.
- **Draft:** unchanged: the card has no `spend` step and does not move Escalation. Its `mod` wording changes only under Q28-A-clear or Q28-B.
- **Open points:** Q28.

### e1-neu-002 · Asian Financial Crisis

- **Today:** Record "contagion". Each side chooses: Bail out your partners? Then draw from the Contingency deck of the side that played this card. If LIO says yes, LIO spends 2 points, then until the end of this turn, points spent by LIO count 1 less, never below 1; otherwise, if the result is 3 or more, at the end of this turn, SAE spends 1 point. If SAE says yes, SAE spends 2 points, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, if the result is 3 or more, at the end of this turn, LIO spends 1 point.
- **Draft:** Record "contagion". Each side chooses: Bail out your partners? Then draw from the Contingency deck of the side that played this card. If LIO says yes, LIO spends 2 points on actions, then until the end of this turn, points spent by LIO count 1 less, never below 1; otherwise, if the result is 3 or more, at the end of this turn, SAE spends 1 point on actions. If SAE says yes, SAE spends 2 points on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, if the result is 3 or more, at the end of this turn, LIO spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech, Q28.

### e1-neu-003 · Ruble Default

- **Today:** Record "default". SAE chooses: Default? If yes, (draw from the Contingency deck of the side that played this card, then if the result is 3 or more, SAE spends 2 points, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, until the end of this turn, points spent by SAE count 1 less, never below 1); if no, LIO spends 1 point.
- **Draft:** Record "default". SAE chooses: Default? If yes, (draw from the Contingency deck of the side that played this card, then if the result is 3 or more, SAE spends 2 points on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, until the end of this turn, points spent by SAE count 1 less, never below 1); if no, LIO spends 1 point on actions.
- **Open points:** Split, Tech, Q28.

### e1-neu-004 · Test Ban Treaty

- **Today:** Each side chooses: Ratify? If LIO says yes, (if SAE says yes, record "treaty in force", then LIO spends 2 points, then SAE spends 2 points; otherwise, SAE spends 1 point); otherwise, (if SAE says yes, LIO spends 1 point; otherwise, record "treaty stalled", then LIO spends 1 point, then SAE spends 1 point).
- **Design (draft):** Both ratify: 2 each, the treaty is in force and Escalation -1. One ratifies alone: the other free-rides for 1. Neither: 1 each and the treaty stalls. Trust pays; defection is safe.
- **Playable (draft):** `ask both "Ratify?" -> v; if yes v[lio] { if yes v[sae] { marker "treaty in force"; spend lio 2; spend sae 2; escalate -1 } else { spend sae 1 } } else { if yes v[sae] { spend lio 1 } else { marker "treaty stalled"; spend lio 1; spend sae 1 } }`
- **Draft:** Each side chooses: Ratify? If LIO says yes, (if SAE says yes, record "treaty in force", then LIO spends 2 points on actions, then SAE spends 2 points on actions, then lower Escalation by 1; otherwise, SAE spends 1 point on actions); otherwise, (if SAE says yes, LIO spends 1 point on actions; otherwise, record "treaty stalled", then LIO spends 1 point on actions, then SAE spends 1 point on actions).
- **Placement:** P2, last step of the both-ratify branch (decided in docs/design/: only if both ratify). **Open points:** Split, Tech, Place; owner question 46 below.

### e1-neu-006 · Al Jazeera Launches

- **Today:** Record "new voice". Until the end of this turn, points spent by LIO count 1 less, never below 1.
- **Draft:** unchanged: the card has no `spend` step and does not move Escalation. Its `mod` wording changes only under Q28-A-clear or Q28-B.
- **Open points:** Q28.

### e1-neu-007 · First Crew on the ISS

- **Today:** Record "crew aboard". Until the end of this turn, points spent by either side count 1 more.
- **Draft:** unchanged: the card has no `spend` step and does not move Escalation. Its `mod` wording changes only under Q28-A-clear or Q28-B.
- **Open points:** Q28.

### e1-neu-008 · Kyoto Protocol

- **Today:** Record "targets set". Each side chooses: Commit to the targets? Then draw from the Contingency deck of the side that played this card. If LIO says yes, (if the result is 3 or more, LIO spends 1 point), then until the end of this turn, points spent by LIO count 1 less, never below 1. If SAE says yes, (if the result is 3 or more, SAE spends 1 point), then until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Draft:** Record "targets set". Each side chooses: Commit to the targets? Then draw from the Contingency deck of the side that played this card. If LIO says yes, (if the result is 3 or more, LIO spends 1 point on actions), then until the end of this turn, points spent by LIO count 1 less, never below 1. If SAE says yes, (if the result is 3 or more, SAE spends 1 point on actions), then until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Open points:** Tech, Q28.

## Questions for the owner

Owner questions 19, 44, 45 and 46 (deck-plan.md), revisited for the Era 1 cards they name. Every option uses steps
that exist today and keeps the card's decided Escalation move. "x" is what a -1 Ops swing costs the side over the
rest of the turn: 0 if it spends nothing more this turn, 1 for each later spend of 2 or more (a
spend of 1 stays 1). "One more spend" below means one more such spend. **Gap** and **Own** are the
scoring readings in README.md; scoring is not decided.

1. **Partnership for Peace (question 19): SAE's "yes" (SAE 1) always beats "no" (SAE -1 Ops).**
   - **A, keep:** yes is always best under both readings; the card's real effect is LIO 1 and Escalation -1.
   - **B, joining helps both:** yes becomes `spend sae 1; spend lio 1`. Under Gap, yes is even and no costs x, so
     SAE stays out only when it has no more spends this turn and would rather LIO not place: a small positional
     choice. Under Own, yes is still always best.
   - **Recommend:** under Gap, B; under Own, A (no option with today's steps makes it a real choice without a new
     cost, and question 19 already accepted it as flavour).
2. **Budapest Memorandum (question 44): honouring (SAE 1) always beats paper (LIO 1).**
   - **A, keep.**
   - **B, question 44's fix:** add `mod sae -1 min 1 (turn)` to yes, after its spend: honouring ties Moscow's hands.
     SAE weighs 1 point now less x against giving LIO 1 and setting the lasting "hollow assurance" tag. Under Own,
     the answers are even with one more SAE spend this turn and no wins with two; under Gap, no wins with three, or
     sooner if SAE values the tag.
   - **Recommend B** under both readings.
3. **NATO Enlargement 1999 (question 44): a failed protest costs the same as no protest, so protesting is free.**
   - **A, keep.**
   - **B, question 44's fix:** the failed branch becomes `spend lio 2`. Under Gap the protest is an even gamble (SAE
     2 or LIO 2) against a sure LIO 1: on average it still pays, but SAE reading a low draw ahead in its deck stays
     out. Under Own a failed protest still costs SAE nothing, so yes stays best.
   - **C, failure costs tempo:** the failed branch becomes `spend lio 1; mod sae -1 min 1 (turn)`. On average the
     protest still pays, but a failure now costs SAE x, so SAE reading a low draw ahead stays out under Gap and Own.
   - **Recommend C:** it works under both readings and leaves the "no" branch alone.
4. **Oslo Accords (question 44): backing the spoilers adds SAE 1 on top of the same LIO 1.**
   - **A, keep.**
   - **B, question 44's fix:** add `mod sae -1 min 1 (turn)` to yes, after its spend. SAE gains 1 now and loses x;
     the answers are even when SAE has one more spend this turn, and staying out wins with two. The same under Gap
     and Own.
   - **C, the broker rallies more:** yes becomes `spend sae 1; on turnEnd { spend lio 2 }`. Under Gap, yes and no
     are even (a point now against two later); under Own, yes is still always best.
   - **Recommend B.**
5. **Shock Therapy Backlash (question 45): funding gives both sides 1.**
   - **A, keep:** under Gap the two answers leave the gap the same, and the choice is where the points land: LIO
     places 1 now, SAE 1 at turn end (Turn-end applies). Now that points go on the map, that is a real positional
     choice. Under Own, yes is always best for LIO.
   - **B, the money comes with strings:** add `mod lio -1 min 1 (turn)` to yes. Under Own, LIO weighs 1 now
     against x. Under Gap, no becomes always best.
   - **Recommend:** under Gap, A; under Own, B.
6. **Test Ban Treaty (question 46): a stag hunt only under Own.** Under Gap the payoffs in points are zero-sum and
   the same for both sides, so whatever the numbers, one answer is always best or the answers are equal; only the
   Escalation move (both ratify) is not zero-sum.
   - **A, keep:** under Own it is a stag hunt (2 each if both ratify, 1 for defecting). Under Gap, "no" is always
     best.
   - **B, any failure stalls:** a lone ratification reads like neither (`marker "treaty stalled"; spend lio 1; spend sae 1`).
     Under Gap every outcome leaves the gap the same, so the sides choose on the board: a bigger round of
     placements (2 each) and Escalation -1, or 1 each. Under Own, ratifying is never worse.
   - **Recommend:** under Own, A; under Gap, B.
