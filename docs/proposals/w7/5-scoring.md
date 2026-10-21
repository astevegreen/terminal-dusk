Proposal, not a rule

# Topic 5: scoring (when it happens and how a game is won)

Part of the [W7 proposal](README.md). Decides nothing.

Core-loop.md lists "how scoring cards are played" and "the tension track and scoring" under "Not decided yet". Today
a game ends only at the turn limit with no winner, or by resignation. Every option here keeps what is settled:
scores and thresholds are whole numbers (Decision 1); any score track stops at its ends (Guardrails); victory
conditions are scenario data picked from a fixed menu (Decision 4); the base game always stops at 2025
(docs/design/eras.md); battlegrounds are part of the map (Decision 4). The words for scoring levels below are
placeholders.

Every option needs a way to count a region: here, a side is **present** in a region if it controls at least one
country there, **ahead** if it controls more countries and more battlegrounds than the rival, and **sweeps** it if
it controls every battleground. Control comes from topic 2.

## Option A: scoring cards in the deck, and one shared score track

- **When:** each region has a scoring card, shuffled into the era where its region's story peaks (for example a
  Middle East scoring card in Era 2). Playing it scores that region at once.
- **How scoring cards are played:** a scoring card must be played in the turn it is drawn (a hand cannot end a turn
  holding one), and it gives no action points.
- **Score:** one track from LIO's end to SAE's end (as in topic 3 option B), stored as 0 to 2 x the target. Present,
  ahead and sweep score fixed amounts per region, plus 1 per battleground controlled.
- **Win:** the track reaches a side's end (instant win), or at the end of 2025 the side the track leans towards
  wins; even is a draw. Topic 4 may add an instant loss.

**Fit with the era files.** No existing card is a scoring card, so these would be new cards; the "theme coverage"
list in deck-plan.md suggests one per region. Helps the Hold cards (Mogadishu, Shanghai Five, Petrocaribe, Annexation
of Crimea, Syrian Intervention) if their turn-end payments land just before a scoring card. Interacts with the
refill rule (core-loop.md, "Refilling hands"): a scoring card drawn by the rival's refill reaches whoever draws it,
so who may play it must be stated.

**Phone-first.** A scoring card is one play and one big animation; the region's result shows on the zoomed-out
region label.

**Engine work.** A `scoring` flag on cards (Decision 4's `CardDef` has `flags.scoring`; the schema removed flags
until a rule uses them), a "must play this turn" check in the play Decision, a scoring step per region, the
`scoring` hook (Decision 4), a `regionScored` event with its presentation entry, the score track and its
`trackMoved` event, a game-over check with a winner and new end reasons. The scoring card count changes the
first-era card count (core-loop.md asks for at least twice the hand size).

**Game length.** Unpredictable timing; a game can end early on an instant win.

## Option B: every region scores at the end of each era, no scoring cards

- **When:** at the end of the last turn of each era (three times in the base game), every region scores, in a
  fixed order. No scoring cards exist.
- **Score:** one shared track as in option A, with present, ahead and sweep amounts per region, plus battlegrounds.
- **Win:** the track reaches a side's end, or the side ahead after the final era (2025) wins; even is a draw.

**Fit with the era files.** Fits the era structure (eras.md): each era's story is judged when it closes, so the
era-opening cards (September 11, Global Financial Crisis) start a new contest. Helps the Hold cards in the last turn
of an era. Strains nothing in the deck, since no card needs to become a scoring card; it does leave "how scoring
cards are played" (core-loop.md) answered as "there are none".

**Phone-first.** Scoring happens at known times, shown as one summary screen per era, region by region.

**Engine work.** An era-end step in the turn loop (the engine already knows when eras enter), a scoring step per
region, the `scoring` hook, the `regionScored` event, the score track, and the game-over check. No card flags.
Needs to know where each era ends, which depends on era lengths (proposal X4).

**Game length.** Predictable: the game always runs to 2025 unless a side reaches its end of the track.

## Option C: each side's own score against era goals

- **When:** at each era's end, as in option B.
- **Score:** each side has its own total (topic 3 option C's standing, or region points added to it), not a gap.
  An era's goal is a scenario number per side; a side that meets it wins the era.
- **Win:** the side that wins more eras wins; if both win or both miss the same eras, the higher own total at 2025
  wins; equal totals are a draw. A side far enough ahead (scenario number) wins at once.

**Fit with the era files.** Pairs with topic 3 option C: "both get 1" (owner question 45) and Test Ban Treaty's stag
hunt (owner question 46) work as designed, because both sides can meet a goal in the same era. Fits the eras as
chapters. Strains the "-1 Ops this turn" cost cards (Kyoto Protocol, Asian Financial Crisis, Arab Spring), which
would need balancing in two currencies (see topic 3 option C).

**Phone-first.** Two own totals and a goal marker; one era result screen. Simple to explain in the tutorial.

**Engine work.** Two score totals in public state with their ranges, the era-end step, the `scoring` hook, a
`regionScored` or `eraScored` event, a game-over check with a winner. Victory conditions as scenario data from a
fixed menu (Decision 4).

**Game length.** Like option B; close games run to 2025.

## Questions for the owner

1. When does scoring happen: when a region's scoring card is played (A), or at every era's end (B, C)?
2. Are there scoring cards in the deck (A), and if so, who may play one drawn into a hand, and must it be played
   that turn?
3. Is the score one shared track (A, B) or each side's own total (C)?
4. How is the game won: reaching the end of the track, being ahead in 2025, winning more eras, or a mix? Is a draw
   allowed?
5. Do battlegrounds score on their own, beyond counting towards "ahead" and "sweeps"?
6. Should the optional 2025-2027 scenario (eras.md) score differently from the base game?
