Proposal, not a rule

# Topic 4: the tension track

Part of the [W7 proposal](README.md). Decides nothing.

Core-loop.md lists "the tension track" under "Not decided yet". Every option here keeps what is settled: the
track is a whole number (Decision 1) with fixed ends, and every move stops at an end (Guardrails, fuzz invariant
2); it is public state; its length and starting value are scenario data (Decision 4). No card's design line moves
tension today, so any card below that "moves tension" would need a design change first.

The cards that read most naturally as raising tension: Desert Storm Coalition, Taiwan Strait Crisis, Second Chechen
War, Invasion of Iraq, North Korean Nuclear Test, Chinese Anti-Satellite Test, ABM Treaty Withdrawal, Annexation of
Crimea, Full-Scale Invasion, Hypersonics on Parade. As lowering it: Test Ban Treaty, Budapest Memorandum, Oslo
Accords, Partnership for Peace, Libya Disarms, India-US Nuclear Deal.

## Option A: one shared track; whoever pushes it to the top loses

- **Track:** 1 (calm) to 5 (crisis), starting at 2. A whole number.
- **Rises** by 1 for each coup (if topic 3's menu has coups) and through card events. **Falls** by 1 at the end of
  each turn, never below 1.
- **At the top:** the side whose action or event moved it to 5 loses the game at once.
- **Limits:** at 4 or 5, no coups in battlegrounds (or in one region per level), so high tension closes options.

**Fit with the era files.** Helps the Hot cards: a rival holding Full-Scale Invasion or Invasion of Iraq would weigh
4 Ops against an event that pushes tension up under its name, which sharpens the rival-card dilemma (deck-plan.md).
Helps the arms-control splits (Test Ban Treaty, ABM Treaty Withdrawal) as ways to buy room. Strains the cards played
by the rival for points: the event is the card's side's event (core-loop.md), so a raise from a rival-played card
counts against the card's side, which must be stated clearly.

**Phone-first.** One small track, always visible next to the turn counter; a warning colour at 4.

**Engine work.** A tension field in public state, a `moveTrack` step (Decision 4's "move a track"), a
`trackMoved` event kind with its presentation entry, a check at each move that ends the game with a winner and a
new end reason (the game-status type has only turn limit and resignation today), and a "coup allowed" check at the
`placementAllowed` or `coupResult` hook. Fuzz invariant 2 covers the range.

**Game length.** Can end a game early, but only by a mistake; usually no change.

## Option B: one shared track; a crisis at the top costs score, the game goes on

- **Track:** 0 to 6, starting at 2.
- **Rises** as in option A. **Falls** by 1 at each era's start as well as through events.
- **At the top:** a crisis: the side that pushed it to 6 loses score (topic 5) equal to a scenario number, the
  track drops back to 3, and play goes on.

**Fit with the era files.** Helps the same Hot cards as A, with a softer penalty, so an aggressive play is a cost
to weigh, not a sudden loss. Fits the "Gamble" shape (deck-plan.md): risking a crisis is like a Contingency draw
with a real downside. Strains only if topic 3 picks option A (points are actions, no score track): there is then no
score to lose, and the crisis would cost actions instead.

**Phone-first.** As A; a crisis is one event with an animation and a log line.

**Engine work.** As A, but with no game-ending rule; instead a crisis rule that moves the score track (topic 5).
Needs a score track to exist.

**Game length.** No change in length; adds swings.

## Option C: one small track per region

- **Tracks:** each region has a tension number from 0 to 3, starting at 0.
- **Rises** by 1 in a region for each coup or hostile event there; **falls** by 1 in every region at turn end.
- **At 3:** the region is in crisis until it falls: no coups and no placing in its battlegrounds by the side that
  pushed it there.
- No game-ending rule; tension shapes where play can happen.

**Fit with the era files.** Helps the regional stories: the Middle East cards of Era 2 (Invasion of Iraq, Cedar
Revolution, Natanz Revealed), Eastern Europe in Era 3 (Annexation of Crimea, Full-Scale Invasion, Nordic Accession)
and East Asia (Taiwan Strait Crisis, Hainan Island Incident). Strains the worldwide cards (North Korean Nuclear Test
and Hypersonics on Parade have one place; Test Ban Treaty and ABM Treaty Withdrawal have none), which would need a
region chosen by the side the card names.

**Phone-first.** One more number per region; shown on the zoomed-out region label, not on each country, it stays
readable. Six numbers (topic 1 option A) is the most.

**Engine work.** A tension field per region in public state (one compartment, public), the `moveTrack` step with
a region argument, the `trackMoved` event, a region crisis check at the `placementAllowed` hook, and a
`chooseRegion` (or `chooseCountries`) Decision for worldwide cards. Fuzz invariant 2 covers each range.

**Game length.** Slightly longer: frozen regions push play elsewhere.

## Questions for the owner

1. One shared track (A, B) or one per region (C)?
2. What happens at the top: an instant loss for whoever pushed it there (A), a score penalty (B), or a frozen
   region (C)?
3. What raises and lowers tension: coups only, card events only, or both? Does it fall by itself each turn?
4. Should any of the arms-control cards (Test Ban Treaty, ABM Treaty Withdrawal) be redesigned to move tension?
5. Is the word "tension" the final name on screen?
