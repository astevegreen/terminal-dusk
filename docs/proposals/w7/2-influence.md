Proposal, not a rule

# Topic 2: influence (placing it, and controlling a country)

Part of the [W7 proposal](README.md). Decides nothing.

Every option here keeps what is settled: each side's influence in a country is a whole number of 0 or more
(Decision 1; Guardrails, fuzz invariant 2), so every removal stops at 0; each country has a stability (Decision 4);
zoomed out, a country's badge shows net influence in its controller's colour, and zoomed in its box shows
stability and both sides' influence numbers (Decision 6). Net influence is only a display value (the larger number
minus the smaller, shown in the leader's colour), so it is never stored and never negative. Influence is public
state: both sides and spectators see it. Placing several points is one compound answer with free undo while it is
being built (Decision 1; core-loop.md, "Undo").

## Option A: control by a margin equal to stability; adjacency limits placing

- **Control:** a side controls a country when its influence there is at least the country's stability **and** at
  least the rival's influence plus the stability. Example: stability 2, LIO 3 and SAE 1 is LIO control (3 is 2
  more than 1); LIO 3 and SAE 2 is nobody's.
- **Placing:** 1 point places 1 influence in a country where the side already has influence, or next to one
  (topic 1's adjacency), or next to its home box. Placing in a country the rival controls costs 2 points per
  influence.
- **Removing:** only through coups, realignments and card events (topic 3).

**Fit with the era files.** Helps the Hot and Hold cards whose design line is "power consolidated" or "a foothold"
(Second Chechen War, Shanghai Five, Syrian Intervention, Big Bang Enlargement 2004): a big lead is needed to hold a
country, so large one-sided events feel large. Strains the small Split cards whose answers are worth 1 (Partnership
for Peace, Oslo Accords, Litvinenko Poisoning): 1 influence rarely changes control under a margin rule, so these
choices would stay flavour-only (owner questions 19 and 44) unless they act on low-stability countries.

**Phone-first.** Control is not visible from the two numbers at a glance (a player must compare with stability),
so the badge colour does the work: the box shows "controlled" only when the margin is met. Placing needs the map
to highlight legal targets and the doubled cost.

**Engine work.** An `addInfluence` step (named in Decision 4's atomic steps) and a `removeInfluence` step, a
`distributeInfluence` Decision kind (named in Decision 1) with its UI prompt (hard rule 9), an `influenceChanged`
event kind with its presentation entry, a `controls` Condition for card `if` steps, and pure helpers the UI uses for
live cost previews (Decision 6). The `placementAllowed` hook (Decision 4) carries card changes such as "SAE may
place anywhere in Asia this turn".

**Game length.** The slowest of the three: margins mean a contested country takes several plays to flip.

## Option B: control by a lead and at least stability; placing within a region

- **Control:** a side controls a country when its influence is at least the stability **and** more than the
  rival's. Example: stability 2, LIO 3 and SAE 2 is LIO control.
- **Placing:** 1 point places 1 influence anywhere in a region where the side already has influence (or the
  region next to its home box). No doubled cost.
- **Removing:** through coups, realignments and card events.

**Fit with the era files.** Helps the small Split and Swing cards: with control by any lead, a 1-point answer
(Partnership for Peace, Oslo Accords, Kosovo Declares Independence, AI Compute Race) can flip a country, which
gives those choices weight (owner question 44). Helps "Both get 1" answers (Shock Therapy Backlash, China Joins the
WTO, Litvinenko Poisoning, Parallel Plumbing, Hong Kong Security Law; owner question 45) when the two points land in
different countries. Strains the big Hot cards: 3 influence flips almost any country, so Desert Storm Coalition,
Handover of Hong Kong and Full-Scale Invasion could swing a region in one play.

**Phone-first.** Control is easy to read: the bigger number wins once it reaches stability. The region rule means
the map highlights a whole zoomed-in region as legal, which needs no adjacency lines (suits topic 1 options B or C).

**Engine work.** The same steps, Decision kind, event kind and Condition as option A. The placement check is
simpler (region membership instead of adjacency). The `placementAllowed` hook still applies.

**Game length.** Faster than A: countries flip often, so play is lively and swingy.

## Option C: capped influence, and placing pushes the rival out first

- **Cap:** each side's influence in a country is at most the country's stability plus 2. A placement past the cap
  is not allowed.
- **Placing pushes:** each point spent in a country where the rival has influence removes 1 rival influence
  (stopping at 0) instead of adding one of your own. Only when the rival has none there does a point add your own.
- **Control:** a side controls a country when it has at least the stability there and the rival has none.
- **Placing where:** as in option A (adjacency) or option B (region), whichever topic 1 picks.

**Fit with the era files.** Helps the tug-of-war cards whose design is about pushing the other side out (Cedar
Revolution, Annexation of Crimea, Nordic Accession, Fall of the Assad Regime, whose "foothold" tag Assad's fall
removes): a play either erodes the rival or builds your own, never both. Strains the "both prosper" cards (China
Joins the WTO, Parallel Plumbing): two sides gaining in the same place cannot happen, so their "both get 1" answers
would need to name different countries.

**Phone-first.** The smallest numbers on the board (never more than stability plus 2), so boxes stay compact, and
at most one side has a non-zero number in a controlled country, which makes badges very clear. Both numbers are
still shown zoomed in (Decision 6); one is often 0.

**Engine work.** The same steps, Decision kind, event kind and Condition as option A, plus the cap and the push
rule inside `addInfluence`. Fuzz invariant 2 gains a check that no influence passes its cap (a "track stays in
range" kind of check). The cap is scenario data.

**Game length.** Short and readable; removing comes from every placement, so coups and realignments matter less
(topic 3).

## Questions for the owner

1. What does control need: a margin equal to stability (A), any lead plus reaching stability (B), or holding the
   country alone (C)?
2. Where can influence be placed: next to your influence (A), anywhere in a region you are in (B), or either with
   the push rule (C)?
3. Does placing in a rival-controlled country cost more (A), or is it the same price (B, C)?
4. Should influence per country have a cap (C), or no cap (A, B)?
5. What does each side start with on the map (scenario starting setup, Decision 4)? This is likely a separate
   design task once the map is chosen.
