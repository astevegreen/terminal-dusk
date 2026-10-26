Proposal, not a rule

# Era 2 cards: rules text reworded now that points have a use

The 30 cards of `docs/design/cards/era-2.md`, in that file's order. Wording rules, open points and their
alternative wordings are in [README.md](README.md); the format is [era-1.md](era-1.md)'s. Each entry gives today's
rules text (from the card's JSON) and the draft. **Open points** names the README open points the draft depends on;
the draft is written in their first alternative (Split-any, Turn-end-any, Tech-yes, Q28-A as today) and picks none
of them. The six cards that move Escalation also get a draft Design and Playable line, and **Placement** names where
the move sits (README question 1, **Place**). Nothing else in any card's effect changes. Nothing here is decided:
each draft waits for the owner's approval.

## LIO (11)

### e2-lio-002 · Article 5 Invoked

- **Today:** Record "allies rally". LIO spends 1 point. Until the end of this turn, points spent by LIO count 1 more.
- **Draft:** Record "allies rally". LIO spends 1 point on actions. Until the end of this turn, points spent by LIO count 1 more.
- **Open points:** Tech, Q28.

### e2-lio-004 · ABM Treaty Withdrawal

- **Today:** LIO chooses: Leave the treaty? If yes, record "treaty gone", then LIO spends 2 points, then SAE spends 1 point; if no, LIO spends 1 point.
- **Design (draft):** LIO decides: leave (LIO 2, but SAE 1 as Moscow gains a grievance, and Escalation +1: the old ceiling on missile defence is gone) or stay (LIO 1).
- **Playable (draft):** `ask lio "Leave the treaty?" -> v; if yes v { marker "treaty gone"; spend lio 2; spend sae 1; escalate +1 } else { spend lio 1 }`
- **Draft:** LIO chooses: Leave the treaty? If yes, record "treaty gone", then LIO spends 2 points on actions, then SAE spends 1 point on actions, then raise Escalation by 1; if no, LIO spends 1 point on actions.
- **Placement:** P2, last step of the "yes" branch (decided in docs/design/: only if LIO leaves); the "no" branch has no move. Under P1 it would be the first step of the "yes" branch, before both spends. **Open points:** Split, Tech, Place.

### e2-lio-006 · Libya Disarms

- **Today:** Record "programme surrendered". LIO spends 2 points.
- **Design (draft):** LIO 2; sets a "disarmament bargain" tag that a later intervention card would break (W3). Escalation -1: a weapons programme is given up.
- **Playable (draft):** `marker "programme surrendered"; spend lio 2; escalate -1`
- **Draft:** Record "programme surrendered". LIO spends 2 points on actions. Lower Escalation by 1.
- **Placement:** P2 (last step; the card has no choice or draw, so B1 and B2 are the same). **Open points:** Split, Tech, Place.

### e2-lio-007 · Big Bang Enlargement 2004

- **Today:** Record "eastward". LIO spends 3 points. At the end of this turn, if "union founded" has been recorded this game, LIO spends 2 points, or 1 point if SAE played this card; otherwise, LIO spends 1 point if LIO played this card. If this card's event happens, remove it from the game afterwards.
- **Draft:** Record "eastward". LIO spends 3 points on actions. At the end of this turn, if "union founded" has been recorded this game, LIO spends 2 points on actions, or 1 point on actions if SAE played this card; otherwise, LIO spends 1 point on actions if LIO played this card. If this card's event happens, remove it from the game afterwards.
- **Open points:** Split, Turn-end, Tech. Its turn-end payment can be 2, which README's Turn-end does not cover: question 4 below.

### e2-lio-008 · Smartphones and Social Networks

- **Today:** Record "everyone is connected". LIO spends 1 point. Until the end of this turn, points spent by either side count 1 more.
- **Draft:** Record "everyone is connected". LIO spends 1 point on actions. Until the end of this turn, points spent by either side count 1 more.
- **Open points:** Tech, Q28.

### e2-lio-009 · Ana Montes Unmasked

- **Today:** Record "mole exposed". LIO spends 1 point. Until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Draft:** Record "mole exposed". LIO spends 1 point on actions. Until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Open points:** Tech, Q28.

### e2-lio-010 · PEPFAR

- **Today:** Record "clinics open". LIO spends 1 point. SAE chooses: Match it with your own aid? If yes, SAE spends 1 point, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, LIO spends 1 point.
- **Draft:** Record "clinics open". LIO spends 1 point on actions. SAE chooses: Match it with your own aid? If yes, SAE spends 1 point on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, LIO spends 1 point on actions.
- **Open points:** Tech, Q28.

### e2-lio-011 · Cedar Revolution

- **Today:** Record "troops out". SAE chooses: Back the old order? If yes, (draw from SAE's Contingency deck, then if the result is 4 or more, SAE spends 2 points; otherwise, LIO spends 2 points); if no, LIO spends 1 point.
- **Draft:** Record "troops out". SAE chooses: Back the old order? If yes, (draw from SAE's Contingency deck, then if the result is 4 or more, SAE spends 2 points on actions; otherwise, LIO spends 2 points on actions); if no, LIO spends 1 point on actions.
- **Open points:** Split, Tech.

### e2-lio-012 · Euro Cash

- **Today:** Record "single currency". If "union founded" has been recorded this game, LIO spends 2 points; otherwise, LIO spends 1 point. At the end of this turn, LIO spends 1 point.
- **Draft:** Record "single currency". If "union founded" has been recorded this game, LIO spends 2 points on actions; otherwise, LIO spends 1 point on actions. At the end of this turn, LIO spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech.

### e2-lio-013 · India-US Nuclear Deal

- **Today:** Record "new partner". LIO spends 2 points. SAE chooses: Court India too? If yes, SAE spends 1 point, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, LIO spends 1 point.
- **Design (draft):** LIO 2; SAE may court India too (SAE 1 but -1 Ops this turn) or concede the partner (LIO 1 more). Either way Escalation -1: India's civil programme comes under inspection.
- **Playable (draft):** `marker "new partner"; spend lio 2; ask sae "Court India too?" -> v; if yes v { spend sae 1; mod sae -1 min 1 (turn) } else { spend lio 1 }; escalate -1`
- **Draft:** Record "new partner". LIO spends 2 points on actions. SAE chooses: Court India too? If yes, SAE spends 1 point on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; if no, LIO spends 1 point on actions. Lower Escalation by 1.
- **Placement:** P2 with B1 (last step, outside SAE's choice, so both answers carry it). Under B2 the move would sit in the "no" branch only (SAE concedes, no contest over India). **Open points:** Split, Tech, Q28, Place.

### e2-lio-014 · Fall of the Taliban

- **Today:** Record "Kabul taken". LIO spends 2 points. Draw from LIO's Contingency deck. If the result is 3 or more, record "new government", then LIO spends 1 point; otherwise, record "insurgency regroups", then SAE spends 1 point.
- **Draft:** Record "Kabul taken". LIO spends 2 points on actions. Draw from LIO's Contingency deck. If the result is 3 or more, record "new government", then LIO spends 1 point on actions; otherwise, record "insurgency regroups", then SAE spends 1 point on actions.
- **Open points:** Split, Tech.

## SAE (11)

### e2-sae-001 · Invasion of Iraq

- **Today:** Record "coalition fractures" for the rest of the game. SAE spends 2 points. If SAE played this card, until the end of this turn, points spent by LIO count 1 less, never below 1.
- **Design (draft):** SAE 2 and LIO -1 Ops this turn; a lasting "credibility" tag that Curveball and Abu Ghraib deepen (W1, W3). Escalation +1: a war of choice. If LIO plays it: SAE 2 only, no LIO -1 Ops; Escalation still +1, and a crisis it causes is LIO's.
- **Playable (draft):** `marker "coalition fractures" lasting; spend sae 2; if played sae { mod lio -1 min 1 (turn) }; escalate +1`
- **Draft:** Record "coalition fractures" for the rest of the game. SAE spends 2 points on actions. If SAE played this card, until the end of this turn, points spent by LIO count 1 less, never below 1. Raise Escalation by 1.
- **Placement:** P2 with B1 (last step, outside the "if played" test). **Open points:** Split, Tech, Q28, Place.

### e2-sae-002 · Curveball

- **Today:** LIO chooses: Act on the single source? If yes, (draw from LIO's Contingency deck, then if the result is 5 or more, LIO spends 2 points; otherwise, record "intelligence discredited", then if "coalition fractures" has been recorded this game, SAE spends 2 points; otherwise, SAE spends 1 point; then until the end of this turn, points spent by LIO count 1 less, never below 1); if no, LIO spends 1 point.
- **Draft:** LIO chooses: Act on the single source? If yes, (draw from LIO's Contingency deck, then if the result is 5 or more, LIO spends 2 points on actions; otherwise, record "intelligence discredited", then if "coalition fractures" has been recorded this game, SAE spends 2 points on actions; otherwise, SAE spends 1 point on actions; then until the end of this turn, points spent by LIO count 1 less, never below 1); if no, LIO spends 1 point on actions.
- **Open points:** Split, Tech, Q28.

### e2-sae-003 · Olympic Summer 2008

- **Today:** Record "summer of 2008". SAE spends 3 points. If SAE played this card, until the end of this turn, points spent by SAE count 1 more. If this card's event happens, remove it from the game afterwards.
- **Draft:** Record "summer of 2008". SAE spends 3 points on actions. If SAE played this card, until the end of this turn, points spent by SAE count 1 more. If this card's event happens, remove it from the game afterwards.
- **Open points:** Split, Tech, Q28.

### e2-sae-004 · Estonian Cyberattacks 2007

- **Today:** Draw from SAE's Contingency deck. If the result is 3 or more, record "sites down", then SAE spends 2 points; otherwise, record "cyber defence doctrine", then LIO spends 1 point.
- **Draft:** Draw from SAE's Contingency deck. If the result is 3 or more, record "sites down", then SAE spends 2 points on actions; otherwise, record "cyber defence doctrine", then LIO spends 1 point on actions.
- **Open points:** Split, Tech.

### e2-sae-005 · Litvinenko Poisoning

- **Today:** Record "polonium". SAE spends 1 point. LIO chooses: Expel diplomats? If yes, LIO spends 1 point, then at the end of this turn, SAE spends 1 point; if no, record "unanswered".
- **Draft:** Record "polonium". SAE spends 1 point on actions. LIO chooses: Expel diplomats? If yes, LIO spends 1 point on actions, then at the end of this turn, SAE spends 1 point on actions; if no, record "unanswered".
- **Open points:** Turn-end, Tech; owner question 45, question 2 below.

### e2-sae-007 · North Korean Nuclear Test

- **Today:** Record "first test". Draw from SAE's Contingency deck. If the result is 4 or more, SAE spends 2 points; otherwise, (if the result is 2 or less, LIO spends 1 point; otherwise, SAE spends 1 point).
- **Design (draft):** A three-way draw: big success (SAE 2), fizzle (SAE 1) or a backlash that unites LIO (LIO 1). Whatever the draw, Escalation +1: a new state has the bomb.
- **Playable (draft):** `marker "first test"; draw sae -> d; if d >= 4 { spend sae 2 } else { if d <= 2 { spend lio 1 } else { spend sae 1 } }; escalate +1`
- **Draft:** Record "first test". Draw from SAE's Contingency deck. If the result is 4 or more, SAE spends 2 points on actions; otherwise, (if the result is 2 or less, LIO spends 1 point on actions; otherwise, SAE spends 1 point on actions). Raise Escalation by 1.
- **Placement:** P2 with B1 (last step, after the draw and all three of its results, so every result carries it). Under B2 the story fits every result too (the device goes off in each), so B2 places it the same way. **Open points:** Split, Tech, Place.

### e2-sae-008 · Petrocaribe

- **Today:** Record "oil diplomacy". SAE spends 2 points. At the end of this turn, LIO spends 1 point.
- **Draft:** Record "oil diplomacy". SAE spends 2 points on actions. At the end of this turn, LIO spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech.

### e2-sae-010 · Peace Mission 2005

- **Today:** Record "joint exercise". SAE spends 2 points. Until the end of this turn, points spent by SAE count 1 more.
- **Draft:** Record "joint exercise". SAE spends 2 points on actions. Until the end of this turn, points spent by SAE count 1 more.
- **Open points:** Split, Tech, Q28.

### e2-sae-011 · Munich Speech 2007

- **Today:** Record "unipolar moment over". Until the end of this turn, points spent by SAE count 1 more.
- **Draft:** unchanged: the card has no `spend` step and does not move Escalation. Its `mod` wording changes only under Q28-A-clear or Q28-B.
- **Open points:** Q28.

### e2-sae-012 · Abu Ghraib

- **Today:** Record "credibility hit". If "coalition fractures" has been recorded this game, SAE spends 2 points; otherwise, SAE spends 1 point. Until the end of this turn, points spent by LIO count 1 less, never below 1.
- **Draft:** Record "credibility hit". If "coalition fractures" has been recorded this game, SAE spends 2 points on actions; otherwise, SAE spends 1 point on actions. Until the end of this turn, points spent by LIO count 1 less, never below 1.
- **Open points:** Split, Tech, Q28.

### e2-sae-013 · Chinese Anti-Satellite Test

- **Today:** Record "debris field". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 2 points; otherwise, SAE spends 1 point, then LIO spends 1 point.
- **Design (draft):** The demonstration impresses (SAE 2) or the debris angers everyone (SAE 1, LIO 1). Either way Escalation +1: weapons have reached orbit.
- **Playable (draft):** `marker "debris field"; draw sae -> d; if d >= 3 { spend sae 2 } else { spend sae 1; spend lio 1 }; escalate +1`
- **Draft:** Record "debris field". Draw from SAE's Contingency deck. If the result is 3 or more, SAE spends 2 points on actions; otherwise, SAE spends 1 point on actions, then LIO spends 1 point on actions. Raise Escalation by 1.
- **Placement:** P2 with B1 (last step, after the draw and both its results, so both carry it). Under B2 the story fits both results too (the missile is fired either way), so B2 places it the same way. **Open points:** Split, Tech, Place.

## Neutral (8)

### e2-neu-001 · China Joins the WTO

- **Today:** Record "open trade". LIO spends 1 point. SAE spends 2 points. LIO chooses: Grant permanent normal trade? If yes, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, LIO spends 1 point, then SAE spends 1 point; otherwise, SAE spends 1 point.
- **Draft:** Record "open trade". LIO spends 1 point on actions. SAE spends 2 points on actions. LIO chooses: Grant permanent normal trade? If yes, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, LIO spends 1 point on actions, then SAE spends 1 point on actions; otherwise, SAE spends 1 point on actions.
- **Open points:** Split, Tech; owner question 45, question 3 below.

### e2-neu-002 · September 11

- **Today:** Record "shock". LIO spends 1 point. SAE spends 1 point.
- **Draft:** Record "shock". LIO spends 1 point on actions. SAE spends 1 point on actions.
- **Open points:** Tech.

### e2-neu-003 · SARS

- **Today:** Record "outbreak". Each side chooses: Report cases openly? If LIO says yes, LIO spends 1 point; otherwise, until the end of this turn, points spent by LIO count 1 more, then draw from the Contingency deck of the side that played this card, then if the result is 3 or more, at the end of this turn, SAE spends 1 point. If SAE says yes, SAE spends 1 point; otherwise, until the end of this turn, points spent by SAE count 1 more, then draw from the Contingency deck of the side that played this card, then if the result is 3 or more, at the end of this turn, LIO spends 1 point. If both say no, each of these end-of-turn spends that happens counts 2, because the spender's own "count 1 more" is still in force.
- **Draft:** Record "outbreak". Each side chooses: Report cases openly? If LIO says yes, LIO spends 1 point on actions; otherwise, until the end of this turn, points spent by LIO count 1 more, then draw from the Contingency deck of the side that played this card, then if the result is 3 or more, at the end of this turn, SAE spends 1 point on actions. If SAE says yes, SAE spends 1 point on actions; otherwise, until the end of this turn, points spent by SAE count 1 more, then draw from the Contingency deck of the side that played this card, then if the result is 3 or more, at the end of this turn, LIO spends 1 point on actions. If both say no, each of these end-of-turn spends that happens counts 2, because the spender's own "count 1 more" is still in force.
- **The "counts 2" sentence under each reading of Q28** (README, wording rule 4):
  - **Q28-A** (today's words): as in the draft above.
  - **Q28-A-clear:** the two `mod` sentences become _until the end of this turn, each time LIO spends points, it spends 1 more_ (and the same for SAE), and the last sentence becomes _If both say no, each of these end-of-turn spends that happens is 2 points, because the spender's own "1 more" is still in force._
  - **Q28-B:** the two `mod` sentences become _until the end of this turn, cards LIO plays for points give 1 more point_ (and the same for SAE). A leak point is an event spend, not a card played for points, so the +1 no longer reaches it: each leak is 1 point and the last sentence is dropped. That undoes owner question 35 ("keep it at 2"): question 5 below.
- **Open points:** Turn-end (the leak spends; README: the wording holds when the amount is 2), Tech, Q28.

### e2-neu-004 · IPCC Report and Nobel 2007

- **Today:** Record "climate consensus". At the end of this turn, LIO spends 1 point, then SAE spends 1 point.
- **Draft:** Record "climate consensus". At the end of this turn, LIO spends 1 point on actions, then SAE spends 1 point on actions.
- **Open points:** Turn-end, Tech.

### e2-neu-005 · Oil at $147

- **Today:** Record "oil spike". SAE chooses: Open the taps? If yes, SAE spends 1 point, then LIO spends 1 point; if no, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, SAE spends 2 points, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Draft:** Record "oil spike". SAE chooses: Open the taps? If yes, SAE spends 1 point on actions, then LIO spends 1 point on actions; if no, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, SAE spends 2 points on actions, then until the end of this turn, points spent by SAE count 1 less, never below 1; otherwise, until the end of this turn, points spent by SAE count 1 less, never below 1.
- **Open points:** Split, Tech, Q28. (Its "yes" gives both sides 1, but question 45 does not name it; not revisited here.)

### e2-neu-006 · Natanz Revealed

- **Today:** Record "programme revealed" for the rest of the game. SAE spends 1 point. At the end of this turn, LIO spends 1 point.
- **Draft:** Record "programme revealed" for the rest of the game. SAE spends 1 point on actions. At the end of this turn, LIO spends 1 point on actions.
- **Open points:** Turn-end, Tech.

### e2-neu-007 · Kosovo Declares Independence

- **Today:** Record "precedent set" for the rest of the game. LIO spends 1 point. SAE spends 1 point.
- **Draft:** Record "precedent set" for the rest of the game. LIO spends 1 point on actions. SAE spends 1 point on actions.
- **Open points:** Tech.

### e2-neu-008 · Sovereign Wealth Funds

- **Today:** Record "petro-dollars". LIO chooses: Let them buy in? If yes, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, LIO spends 2 points; otherwise, LIO spends 1 point; either way, at the end of this turn, SAE spends 1 point. If no, LIO spends 1 point.
- **Draft:** Record "petro-dollars". LIO chooses: Let them buy in? If yes, draw from the Contingency deck of the side that played this card, then if the result is 3 or more, LIO spends 2 points on actions; otherwise, LIO spends 1 point on actions; either way, at the end of this turn, SAE spends 1 point on actions. If no, LIO spends 1 point on actions.
- **Open points:** Split, Turn-end, Tech.

## Questions for the owner

"x" is what a -1 Ops swing costs the side over the rest of the turn, as in era-1.md: 0 if it spends nothing more
this turn, 1 for each later spend of 2 or more (a spend of 1 stays 1). **Gap** and **Own** are the scoring
readings in README.md; scoring is not decided, so each answer below is given for both. Every option uses steps
that exist today.

1. **Owner questions 19, 44 and 46 name no Era 2 card.** Question 19 names Partnership for Peace and Ghost Stories,
   question 44 names Era 1 and Era 3 cards, question 46 names Test Ban Treaty; era-1.md (and X10c for Era 3)
   revisits them. Of question 45's cards, only Litvinenko Poisoning and China Joins the WTO are Era 2.
2. **Litvinenko Poisoning (question 45): expelling gives both sides 1.** LIO chooses; SAE's first point is fixed.
   - **A, keep:** under Gap both answers leave the gap the same, and the choice is where the points land: LIO
     places 1 now, SAE 1 at turn end (Turn-end applies). That is a real positional choice. Under Own, yes is
     always best for LIO.
   - **B, expulsions cost tempo:** add `mod lio -1 min 1 (turn)` to yes, after its spend. Under Own, LIO weighs 1
     now against x. Under Gap, no becomes always best (yes is even less x).
   - **C, a harder response:** yes becomes `spend lio 2; mod lio -1 min 1 (turn); on turnEnd { spend sae 1 }`.
     Under Gap, yes is +1 less x: the answers are even when LIO has one more spend this turn and no wins with
     two. Under Own, the answers are even with two more LIO spends and no wins with three. Changes a number as
     well as adding a step.
   - **Recommend:** under Gap, A (the smallest change, and the board makes it a choice); under Own, B (the same
     fix as Shock Therapy Backlash in era-1.md, so the two cards read alike).
3. **China Joins the WTO (question 45): granting is a free gamble under Own and never pays under Gap.** LIO
   chooses; the draw is from the deck of the side that played the card (4 in 6 for 3 or more).
   - **A, keep:** under Gap a grant gives the gap 0 (high draw) or -1 for LIO (low draw) against 0, so no is
     always best on points. Under Own a grant gives LIO 1 or 0 against 0, so yes is always best.
   - **B, a bigger prize:** the high-draw branch becomes `spend lio 2; spend sae 1`. Under Gap a grant is +1 or -1
     against a sure 0: worth it on average, but a side reading a low draw ahead in the deck says no. Under Own,
     yes is still always best.
   - **C, a low draw costs tempo:** the low-draw branch becomes `spend sae 1; mod lio -1 min 1 (turn)`. Under Own a
     grant is +1 or -x against 0: a real gamble when LIO has later spends. Under Gap, no is still always best.
   - **Recommend:** under Gap, B; under Own, C. Both together (B and C) make it a gamble under both readings, at
     the cost of two changes to one card.
4. **Big Bang Enlargement 2004: a 2-point turn-end payment.** README's Turn-end covers 1-point payments only. This
   draft reads the 2 like any spend (Split applies) and each 1 under Turn-end. Under Turn-end-place the sentence
   would read: _At the end of this turn, if "union founded" has been recorded this game, LIO spends 2 points on
   actions, or 1 point placing influence if SAE played this card; otherwise, LIO spends 1 point placing influence
   if LIO played this card._ Should a 2-point turn-end payment also be limited to placing influence?
5. **SARS under Q28-B: is a leak still 2 when both hide it?** Question 35 kept it at 2. Under Q28-B the +1 no
   longer reaches a leak, so the owner would choose: **S1**, accept 1 and drop the sentence (simpler; reopens
   question 35); or **S2**, keep 2 by changing the steps, for example LIO's leak becomes
   `on turnEnd { if yes v[sae] { spend sae 1 } else { spend sae 2 } }` (and the same for SAE's). S2 needs the
   builder to confirm that a trigger can read the answers, and adds a sentence per leak. No recommendation: it
   depends on question 28, and README recommends A-clear, under which the question does not arise.
