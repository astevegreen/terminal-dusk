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
6. **The tech race** (turn 3, LIO's first play, a card played for points; owner, 27 Nov 2026, in chat: "Yes",
   to LIO's first play of turn 3). The learner makes the attempt themselves. Pay the step's cost, then
   draw: on 4 or more the marker moves one step. Each side may try once per turn. A rival card spent on the tech
   race has no event. The chapter explains what each step gives.
7. **Scoring, winning and the two abilities** (end of turn 3, when Era 1 scores). Each region scores for present,
   ahead or every battleground, plus 1 for each battleground controlled, and the score track moves. The chapter
   explains how a game is won, LIO's Resilient institutions and SAE's Unified command. After it the coaching stops.

Turn 2's two LIO plays are chapters 4 and 5, and all of a play's points go to one action, so the tech race waits
for turn 3. Turn 3's second LIO play before the scoring is free, with light hints only.

## Cards dealt first (owner, 27 Nov 2026, in chat: "Approve as written")

The top 16 cards of the Era 1 draw pile are fixed, in this order; the other 13 Era 1 cards are shuffled as usual.

- **LIO's first hand (1-8):** e1-lio-001 Maastricht Treaty, e1-lio-004 NATO Enlargement 1999, e1-sae-008
  Primakov's U-turn, e1-lio-006 Desert Storm Coalition, e1-lio-002 Budapest Memorandum, e1-sae-004 Second Chechen
  War, e1-lio-012 Partnership for Peace, e1-lio-010 Arrest of Aldrich Ames.
- **SAE's first hand (9-16):** e1-sae-002 Handover of Hong Kong, e1-sae-001 Battle of Mogadishu, e1-sae-003 Golden
  Shield, e1-sae-005 The Hanssen Leak, e1-sae-009 Belgrade Embassy Bombing, e1-sae-013 Cox Report, e1-neu-003
  Ruble Default, e1-neu-001 Rwandan Genocide.
- SAE's opening pick needs no script: the Easy AI scores ops + 2 x random (`packages/ai/src/easy.ts`), so Handover
  of Hong Kong (4 points) always beats the rest of SAE's hand (2 or fewer). SAE's hand holds no LIO cards and no
  "LIO chooses" cards.
- Chapters 1-6 name the card to play. Chapters 1-3 allow placing only, which keeps Crimea's SAE influence for
  chapter 4. The opening picks of turns 2 and 3 are coached steps inside chapters 4 and 6.

## Coaching words (owner, 27 Nov 2026, in chat: "Approve as written")

The coaching shows the quoted lines in this order.

**Numbers and places come from the live game** (owner, 27 Nov 2026, in chat: "Yes", to filling them in from the
game as it is played). SAE's play is not scripted, so the game can differ from the lines as written: Handover of
Hong Kong's points can clear Taiwan, and cards such as Rwandan Genocide make spends smaller for a turn. So every
number of points and every place a line quotes is filled in from the game at the moment the line shows. Chapter
1's "(Taiwan)" names the countries where LIO then has influence. If there are none, the line drops its
own-influence part and reads "You can place next to the United States (Mexico, Cuba, Canada)." (owner, 27 Nov
2026, in chat: "1", to dropping that part). The
points use what the play really has: for example chapter 2's "4 to spend", chapter 3's arithmetic, chapter 4's "4
points" and the result it gives, chapter 5's "2 points" and chapter 6's "All 3 points". The rest of each line stays
as written.

If SAE has played Rwandan Genocide this turn, it is one more term in chapter 3's arithmetic: "Before: 1, plus 1
from Maastricht, minus 1, minus 1 from Rwandan Genocide, and never below 1, gives 1 point." When before and after
give the same points, "After: you spend 2," becomes "After: you also spend 1, so here the order doesn't change your
points," and the line goes on "and the penalty only reaches ..." as written (owner, 27 Nov 2026, in chat: "I
approve your recommendation").

In chapter 6, Second Chechen War's points can fall below the cost of the step LIO would try: for example, SAE has
taken AI (pulling it back costs 2) and Rwandan Genocide has left the card 1 point. Then chapter 6 still explains the
track, but "Play Second Chechen War, SAE's card, on the tech race." becomes "Your 1 point can't pay this step's cost
of 2 this turn. Play Second Chechen War for its points and place influence instead: its event, SAE's, still
happens.", with the points and cost from the game, and the sentence "All 3 points go to this one try, so any above
the cost are lost." is left out, since there is no try (owner, 27 Nov 2026, in chat: "As you recommend").

**1. Opening cards and events** (turn 1 opening; play Maastricht Treaty)

- "Each turn starts with an opening card. You and SAE each pick one in secret, then both are shown together. An
  opening card is used only for its event: its action points are not spent. Pick Maastricht Treaty."
- After the reveal: "SAE picked Handover of Hong Kong. The card with more action points goes first: Hong Kong has 4
  and Maastricht 2, so SAE's event happens first. On a tie, LIO's pick would go first, whichever side's card it is."
- "Maastricht gives you 1 point now. You can place where you already have influence (Taiwan), next to it, or next
  to the United States (Mexico, Cuba, Canada). For the rest of this turn, each time you spend points, you spend 1
  more."

**2. Influence and control** (turn 1, LIO's first play; NATO Enlargement 1999, placing)

- "Now the card plays: LIO, SAE, LIO, SAE. Play NATO Enlargement 1999 for its points: 3, plus 1 from Maastricht, so
  4 to spend. All of a play's points go to one action."
- "You control a country when your influence there is at least its stability, and at least SAE's influence plus its
  stability. Mexico has stability 2: 2 influence controls it. Placing in a country SAE controls costs 2 points for
  each influence. Where you can place is fixed when the play starts."

**3. Rival cards** (turn 1, LIO's second play; Primakov's U-turn, placing)

- "Primakov's U-turn is SAE's card. You can play it only for its points, and its event still happens, as SAE's
  event."
- "You choose whether the event comes before or after you spend. It makes you spend 1 fewer for the rest of the
  turn. Before: 1, plus 1 from Maastricht, minus 1, gives 1 point. After: you spend 2, and the penalty only reaches
  spends later this turn, when you have no plays left. Chapter 6 shows the one exception: points spent on the tech
  race cancel the event."

**4. Intervene and the Contingency deck** (turn 2)

- Opening (play Partnership for Peace): "Turn 2: both hands fill back up to 8. Pick Partnership for Peace, and keep
  Desert Storm Coalition, Budapest Memorandum and Second Chechen War for the next chapters."
- "Play Desert Storm Coalition for its 4 points and intervene in any country where SAE has influence. It doesn't
  need to be next to yours."
- "There are no dice: you draw a card numbered 1 to 6 from your Contingency deck. Result = draw + points spent - 2 x
  the country's stability. If the result is above 0, SAE loses that much influence there, and what is left over
  becomes yours. With 4 points, a stability-2 country such as Crimea gives a result equal to your draw. An
  intervention in a battleground raises Escalation by 1."
- After the draw: "Both sides see every draw. A used card stays out until the deck is reshuffled, when two are left,
  so a low draw now means higher ones are still to come."

**5. Escalation and realigning** (turn 2, LIO's second play; Budapest Memorandum, realign)

- "Escalation runs from 0 to 6. At 3, Eastern Europe and Central Asia closes to interventions and realignments. At
  4, East and South Asia closes as well, and at 5, Europe. Placing is never blocked. Escalation falls by 1 at each
  turn's end. At 6 there is a crisis: whoever caused it draws from their deck, loses that much score, and Escalation
  drops back to 3."
- "Play Budapest Memorandum for its 2 points and realign: each point is one attempt, on a country where SAE has
  influence, in a region that is still open."
- "Both sides draw. Each side adds 1 for each neighbouring country it controls, 1 if it has more influence there,
  and 1 if its home box touches the country. The higher total wins, and the loser loses the difference in
  influence. A tie changes nothing, and you may stop early. Next to Russia or China, SAE's home box gives it +1."

**6. The tech race** (turn 3)

- Opening (play Arrest of Aldrich Ames): "Turn 3, the last of Era 1. Pick Arrest of Aldrich Ames: its event shows
  you SAE's hand."
- "Play Second Chechen War, SAE's card, on the tech race. Played any other way, its event would give SAE 2 points and
  raise Escalation. Points spent on the tech race cancel a rival card's event."
- "One shared marker starts at parity. Moving it toward your side costs 1 for Networks and Orbit, 2 for AI, 3 for
  Hypersonics and 4 for Quantum Computing. Pulling SAE's lead back costs what SAE's step cost. All 3 points go to
  this one try, so any above the cost are lost. Draw: on 4 or more, the marker moves one step. Each side may try
  once per turn."
- "While the marker is on your side, you hold its step and every step below it. Networks and Orbit gives +1 in your
  realignments, and AI gives +1 on your interventions. Hypersonics gives an extra card play at the end of each turn,
  and reaching it raises Escalation. Quantum Computing makes SAE pick its opening card first, where you can see it,
  and moves the score 1 your way at each era's end. The first side to reach each step gets +1 on its next tech race
  draw."
- Hint (turn 3, LIO's second play): "Your last play before Era 1 scores: look for regions where you are close to
  present or ahead."

**7. Scoring, winning and the abilities** (end of turn 3)

- "Era 1 is over, and every region scores in turn. In each region a side scores only its highest level: present (it
  controls at least one country), ahead (more countries and more battlegrounds than its rival), or every
  battleground. Each battleground controlled adds 1. The score track moves by the difference."
- "You win at once by reaching your end of the track. Otherwise, after 2025 scores, the side the track leans towards
  wins. If it's even, the side ahead on the tech race wins, and if that's even too, it's a draw. The track started 7
  steps towards SAE."
- "LIO's ability, Resilient institutions: the first time each turn a draw from your own deck shows a 1, it is set
  aside and you draw again. SAE's ability, Unified command: after SAE plays its own card for its event, its next card
  played for points that turn counts 1 more."
- "That's the coaching. From here it's a normal game."

**If an ability fires before chapter 7** (the engine's `abilityRedraw` and `abilityBonus` events,
`packages/engine/src/abilityTypes.ts`), a hint shows:

- "Resilient institutions set your 1 aside, and you drew again. Chapter 7 explains."
- "Unified command: SAE's card played for points counted 1 more. Chapter 7 explains."

## Not decided yet

- Credibility is left out until its numbers are decided (docs/design/map-and-points.md, "Escalation").
