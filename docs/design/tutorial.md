# Tutorial

Promoted on 2026-11-27 from the Notion page "Tutorial outline", which the owner co-designed in chat that day. From
now on this file is the source of truth; change it in Notion and promote again. Each chapter teaches only rules
already decided in the other files in `docs/design/`; the tutorial adds no rule of its own.

## Shape (owner, 27 Nov 2026, in chat)

- **One real game, coached in chapters.** The tutorial is a real base-game match on the six-region map from the
  real starting position. Seven chapters are coached in the order the game reaches them. When the last chapter
  ends, the coaching stops and the game goes on as a normal game (owner: "One game, chapters").
- **Seven chapters, one mechanic each** (owner: "Seven lessons").
- **The learner plays LIO in every chapter**, against the Easy AI (owner: "Seven lessons", answering a question that
  set the lessons against the Easy AI; "LIO in every lesson"). SAE's ability is explained in chapter 7.
- **After the coaching, the full base game.** The learner plays on through Eras 2 and 3 to 2025 (owner: "The full
  base game").
- **Free players stop at Era 1's end.** They see the result and a "Full Game" unlock offer; owners of the full game
  play on (owner: "Stop at Era 1, offer unlock"). This keeps the 16 Oct product call that free players get the
  tutorial and the first era against the AI (docs/architecture.md, "Product calls"; docs/design/eras.md, "The free
  player's game").

## Chapters in game order

1. **Opening cards and events** (turn 1, the opening pick). Both sides pick in secret, and the picks are revealed
   together. The card with more action points goes first; on a tie, LIO's pick goes first, whichever side's card it
   is. An opening card is used only for its event.
2. **Influence and control** (turn 1, LIO's first play). Play a card for its action points and place influence
   where LIO already has influence, next to it, or next to its home box. A country is controlled when a side's
   influence is at least its stability and at least the rival's plus its stability. Placing in a country the
   rival controls costs 2 points.
3. **Rival cards** (turn 1, LIO's second play). An SAE card can only be played for its points. Its event still
   happens, as SAE's event, and the player chooses whether it comes before or after the points are spent. The one
   exception, shown in chapter 6: points spent on the tech race cancel the event.
4. **Intervene and the Contingency deck** (turn 2, the first play). There are no dice: the player draws a card
   numbered 1 to 6 instead. Result = draw + points spent - 2 x the country's stability. Every draw is shown to both
   sides, and a used card stays out until that deck is reshuffled. An intervention in a battleground raises
   Escalation.
5. **Escalation and realigning** (turn 2, the second play). Escalation closes one region at 3, a second at 4 and
   a third at 5, falls by 1 at each turn's end, and at 6 causes a crisis that costs score. Realign a country in a
   region that is still open.
6. **The tech race** (a card played for points; which play is not decided yet, below). Pay the step's cost, then
   draw: on 4 or more the marker moves one step. Each side may try once per turn. A rival card spent on the tech
   race has no event. The chapter explains what each step gives.
7. **Scoring, winning and the two abilities** (end of turn 3, when Era 1 scores). Each region scores for present,
   ahead or every battleground, plus 1 for each battleground controlled, and the score track moves. The chapter
   explains how a game is won, LIO's Resilient institutions and SAE's Unified command. After it the coaching stops.

Turn 3's other plays before the scoring are free, with light hints only.

## Not decided yet

- Where chapter 6 sits. Turn 2's two LIO plays are chapters 4 and 5, and all of a play's points go to one action,
  so the learner can't make a tech race attempt in turn 2. Recommended: LIO's first play of turn 3, so the learner
  makes the attempt themselves; turn 3's second play is then free.
- The abilities work from turn 1, before chapter 7 explains them: LIO's redraw of a 1 can happen in chapter 4's
  draw, and SAE's Unified command can fire in turns 1 and 2. The coaching must read right when they do.
- The coaching words for each chapter: short, plain English, in the rules' own terms. Drafts go to the owner for
  approval.
- Which cards sit at the top of the draw pile so each chapter's mechanic turns up (LIO's and SAE's first hands, and
  SAE's opening pick). Drafts go to the owner for approval.
- Credibility is left out until its numbers are decided (docs/design/map-and-points.md, "Escalation").
