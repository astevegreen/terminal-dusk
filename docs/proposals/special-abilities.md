Proposal, not a rule

# Special abilities for LIO and SAE: options

Sprint backlog X3. docs/design/sides.md says each side has exactly one special ability of its own and that which
one is not decided yet. This file lays out three options for each side, with trade-offs. It decides nothing, and
nothing here is a rule until the owner picks an option and it is promoted into docs/design/.

Each option is one ability, stated in one sentence. The numbers in them (1 point, once per turn) are placeholders
to make the trade-offs concrete; they are not proposed values.

## What every option must respect

- **SAE is one player with one pool of influence and no built-in friction between its partners** (sides.md). So no
  option splits SAE into a Russian part and a Chinese part, gives the partners separate pools, or makes one
  partner cost the other something.
- **LIO plays first in every turn and wins ties on opening cards** (core-loop.md). No option changes either.
- **The rival-card rule** (core-loop.md): a rival's card may only be played for its action points, its event still
  runs as the rival's event, and its draws from the rival's own deck come from the World deck. This also holds for
  opening picks, which resolve as events only and never spend their action points.
- **The card-count gap.** The deck holds 28 LIO cards and 38 SAE cards (deck-plan.md, "The deck at a glance"), so LIO
  draws, and has to play, rival cards more often than SAE does. Backlog X5 looks at that gap. Every option that
  triggers on or changes playing a rival's card says how the gap affects it.
- **The map and scoring are not decided (W7).** Each option says whether it can be built and judged without them.

## Engine facts every option shares

These are true of the engine today (`packages/engine/src/types.ts`, `packages/content/schema/`):

- **Hooks.** Triggers can fire at two hook points: `cardPlayed` and `turnEnd`. Modifiers can change one thing:
  the ops value of points spent (`opsValue`), for one side or both. Nothing hooks a Contingency draw yet
  (architecture Decision 4 lists "coup result" as a planned hook, not a built one).
- **Every modifier and trigger comes from a card and ends at turn end.** Each active modifier and trigger records
  its `source` card, and the only duration is "until the end of the turn". A side ability belongs to no card and
  lasts the whole game, so whichever option is picked needs one of two pieces of engine work:
  - **(a) A fixed menu in the scenario.** The scenario names each side's ability from a short fixed list, the way
    Decision 4 has victory conditions picked from a fixed menu. The engine holds one small piece of code per
    ability on the menu. Mods can choose among them but cannot write new ones. Simple, but each ability is code.
  - **(b) Permanent modifiers and triggers as data.** The scenario lists a modifier or trigger for each side with a
    new "whole game" duration and a source that is a side, not a card. Abilities become data like cards, but the
    `source` field and the duration type change, and every place that reads them must handle the new kinds.
    Either way the scenario schema (`packages/content/schema/scenario.ts`) and the engine's setup gain a per-side
    ability field; neither has one today. That is a schema change, so it is its own engine task.
- **New decisions and events need UI entries** (hard rule 9). Today's decisions are `yesNo`, `chooseCard`,
  `playCardAs` and `rivalEventOrder`; any new one needs a prompt in `packages/app/src/decisionPrompts.tsx`, and any
  new event kind needs a log line in `packages/app/src/eventPresentation.ts`. Every option below probably wants one
  new event ("LIO's ability applied") so the log can say why a number changed.
- **The AI.** The Easy AI does not look ahead. It scores each legal answer by the card's printed ops, whether the card
  is the rival's, and some noise (`packages/ai/src/easy.ts`). An ability that changes what a card is worth needs the
  AI to score the changed value, not the printed one.
- **Points have no designed use yet** (deck-plan.md, Owner question 7). Abilities that change points can be built and
  tested now, but how strong they are depends on what points buy, which is part of W7.

## LIO options

### L1. Allied burden-sharing

**Ability:** when LIO plays an SAE card for its action points, those points count 1 more.

- **Theme fit.** LIO is the US-led bloc of real states (sides.md). A network of allies absorbing a rival's move and
  turning it to use fits a coalition better than it fits a single command.
- **Rival-card rule.** It acts only on the rival-card play itself. SAE's event still runs in full, and the player
  still picks before or after. Opening picks never spend action points, so it never applies to them. It touches no
  Contingency deck; the event's draws still come from the World deck.
- **Card-count gap.** This option leans directly on the gap. LIO meets SAE cards more often, so it gets the bonus
  more often. That could soften the gap (the forced plays hurt less) or hide it (the gap stops showing up in win
  rates while it still shapes every hand). X5 and this option should be judged together.
- **Engine work.** Uses the existing `opsValue` modifier, but that modifier applies to every point the side spends,
  so it needs a new filter: "only when the card played is the rival's". A new condition on who played a card is
  already wish-list item W5 (backlog R5). Set by menu (a) or data (b) above. No new decision. One new event for the
  log. The AI must score an SAE card in LIO's hand as worth one more point; today its rival-card weight pushes the
  other way.
- **Phone-first UI.** Low. The play button for an SAE card shows the raised value, plus a small ability badge on
  LIO's side panel and one log line.
- **W7.** Can be built and tested without the map or scoring. Its strength depends on what points buy (W7).

### L2. Resilient institutions

**Ability:** the first time in a turn that a draw from LIO's own Contingency deck shows a 1, that card is set aside and
LIO draws again.

- **Theme fit.** Fits an order built on institutions that absorb shocks: the worst outcome is softened once, not
  removed.
- **Rival-card rule.** When SAE plays an LIO card (as an opening pick or for its action points), that event's draws from
  LIO's deck come from the World deck, so the ability does not apply there. It applies to LIO's own actions, LIO's
  own cards played for their events, neutral events LIO plays, realignments, and any card whose text draws from
  LIO's deck. It does not touch the card-count gap directly.
- **Contingency decks.** The redraw is an ordinary draw: it uses up a second card and brings LIO's reshuffle closer.
  That keeps the decks' "luck evens out" aim in part (the 1 is still spent from the cycle) but shifts LIO's average
  result up. A rival could time a realignment against LIO knowing a redraw is still unused this turn; the use per
  turn would need to be public. The open question in contingency-deck.md about whose bonuses apply to a draw from
  the rival's deck or the World deck would need an answer for this ability too.
- **Engine work.** Needs a new hook on a Contingency draw, after the number is seen and before it is used. That is
  close to the "coup result" hook Decision 4 already plans, but not built. No new decision if the redraw is
  automatic; an optional redraw would need a `yesNo` decision with its own prompt text, since there is no card to
  take the question from. A "once per turn, used" flag must live in public state. One new event ("LIO redrew a
  1"). The AI barely needs to judge it if automatic; it would need to value LIO's deck as slightly better when
  weighing gambles.
- **Phone-first UI.** Low to medium. The Contingency display already shows one die face per card; it needs a short
  "redrawn" mark and a per-turn "used" marker. An optional redraw adds a prompt mid-event.
- **W7.** Independent of the map and scoring.

### L3. Partner network

**Ability:** once per turn, when LIO places influence in a country, it may place 1 more influence in a neighbouring
country where it already has influence.

- **Theme fit.** The strongest fit with "bloc of real states": presence spreads along alliances and neighbours.
- **Rival-card rule.** Works the same whether the points come from LIO's own card or a rival's. It does not change
  the rival's event or any draw. It gives no extra reason to play SAE cards, so it neither eases nor deepens the
  card-count gap.
- **Engine work.** Needs the map, influence and placement rules first, then a trigger or modifier on a "placement"
  hook (Decision 4 lists "placement allowed" as planned). Needs a choice of country, which is a new decision kind
  unless a "choose countries" decision exists by then. Set by menu (a) or data (b). One new event. The AI must
  judge where the extra influence is worth most, which needs map evaluation it does not have yet.
- **Phone-first UI.** Medium. An extra tap on the map after a placement, with the eligible countries highlighted,
  and a skip button.
- **W7.** Depends on W7: it cannot be built, tested or balanced before the map and influence rules exist.

## SAE options

### S1. Unified command

**Ability:** after SAE plays one of its own cards for its event, the next card SAE plays for its action points in the
same turn counts 1 more.

- **Theme fit.** SAE is Russia and China as one side with one player and one pool (sides.md). A move that combines
  one partner's event with the other's follow-up, with no cost between them, shows the unity as a strength without
  adding friction or splitting the pool.
- **Rival-card rule.** An SAE card played by LIO is LIO's play, so it does not set this up. An LIO card SAE plays for
  its action points can be the follow-up that collects the bonus. Whether an SAE opening pick counts as "played for
  its event" is an open question below; if it does, every SAE opening of its own card primes the next play. No
  Contingency deck is touched.
- **Card-count gap.** It rewards SAE for playing its own cards, and SAE holds more of them, so it may widen the gap's
  effect a little. Worth checking with the balance tool (X1).
- **Engine work.** Needs a marker that lasts from one play to the next within the turn and a condition that reads it
  (wish-list W1 and W3, backlog R4), plus a trigger scoped to SAE's own plays (W2, backlog R7). The ops change
  itself uses the existing `opsValue` modifier. Set by menu (a) or data (b). No new decision. One new event ("SAE's
  ability ready" or "applied"). The AI must learn to order its plays: event first, points second. The Easy AI does
  not plan across plays, so it would use the ability only by chance until it does.
- **Phone-first UI.** Low to medium. A "ready" badge on SAE's panel once primed, and the raised value on the next play
  button.
- **W7.** Can be built and tested without the map or scoring. Its strength depends on what points buy (W7).

### S2. Leverage over the rival's moves

**Ability:** when LIO plays an SAE card for its action points, those points count 1 less, never below 1.

- **Theme fit.** Fits a side that uses trade, energy and pressure to make the rival's answers cost more. It does not
  touch SAE's own pool or partners.
- **Rival-card rule.** Acts only on LIO's rival-card plays; SAE's event still runs as before, and opening picks never
  spend points, so they are unaffected. No Contingency deck is touched.
- **Card-count gap.** This option leans hardest on the gap: LIO meets SAE cards more often, so LIO pays this cost more
  often. It would widen whatever imbalance the gap causes, and must be judged together with X5. It is also the
  mirror of L1: if both were picked they would cancel on every SAE card LIO plays.
- **Engine work.** Same as L1: the existing `opsValue` modifier with a new "only on the rival's card" filter (W5,
  backlog R5), set by menu (a) or data (b). The engine already applies a minimum. No new decision. One new event.
  The AI (as LIO) must score SAE cards one point lower, and (as SAE) may hold back from playing LIO cards it would
  rather see LIO forced to use; the Easy AI has no such planning.
- **Phone-first UI.** Low. The lowered value on LIO's play button for SAE cards, a badge, one log line.
- **W7.** Can be built and tested without the map or scoring. Its strength depends on what points buy (W7).

### S3. Continental reach

**Ability:** SAE may place influence in any country next to Russia or China as if it already had influence beside it.

- **Theme fit.** Fits a unified land power spanning Eurasia. It treats Russia and China as one home, so it reads as
  unity, not two partners.
- **Rival-card rule.** Works the same with points from any card. It does not change events or draws, and it does not
  interact with the card-count gap.
- **Engine work.** Needs the map, influence and placement rules (W7) and a "placement allowed" hook (Decision 4,
  planned). No new decision if it only widens where SAE may place. Set by menu (a) or data (b), and the map data must
  mark which countries count as "next to Russia or China". One new event only if the log should explain it. The AI
  must evaluate the map to use it well.
- **Phone-first UI.** Low. The extra countries light up as legal targets during SAE's placement; a badge explains why.
- **W7.** Depends on W7: it cannot be built, tested or balanced before the map and placement rules exist.

## The options at a glance

| Option | Touches rival-card plays | Card-count gap matters | New hook needed       | New decision | W7       |
| ------ | ------------------------ | ---------------------- | --------------------- | ------------ | -------- |
| L1     | yes                      | yes, strongly          | no (needs W5 filter)  | no           | strength |
| L2     | no                       | no                     | yes (on a draw)       | if optional  | no       |
| L3     | no                       | no                     | yes (placement)       | likely       | depends  |
| S1     | partly (follow-up play)  | a little               | no (needs W1, W2, W3) | no           | strength |
| S2     | yes                      | yes, strongly          | no (needs W5 filter)  | no           | strength |
| S3     | no                       | no                     | yes (placement)       | no           | depends  |

"strength" means it can be built now, but how strong it is depends on what points buy.

## Questions for the owner

1. Should the abilities be fixed per side for every scenario, or may a scenario pick them (engine choice (a) or
   (b) above)?
2. Should a side's ability be something the player chooses to use (a prompt), or always automatic?
3. Should the two abilities mirror each other in kind (both about points, both about luck, both about the map), or
   be deliberately different?
4. Is an ability that acts on rival-card plays (L1, S2) welcome, given the card-count gap, or should abilities wait
   until X5 settles the gap?
5. Should the choice wait for the map and scoring (W7), so options like L3 and S3 are possible, or should one that
   works without them be picked first?
6. For S1: does an SAE opening pick of its own card count as "played for its event"?
7. For L2: may a side's ability change a Contingency draw at all, given that the decks exist so that luck evens out?
   And if a draw from the World deck is involved, whose ability applies (the same open point as in
   contingency-deck.md)?
8. Should a side's ability, and whether it was used this turn, be shown to both players at all times?
