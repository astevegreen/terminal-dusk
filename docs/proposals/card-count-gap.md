Proposal, not a rule

# The LIO/SAE card-count gap and the missing Era 3 LIO Ops 4 card: options

Sprint backlog X5. The first deck has fewer LIO cards than SAE cards in every era, and Era 3 has no LIO Ops 4
card since the owner removed Sanctions Wall (deck-plan.md, Owner question 17: "keep the cap at 4; the missing
Era 3 LIO Ops 4 card is a balance question for later"). This file lays out options for both, with trade-offs.
It decides nothing, and nothing here is a rule until the owner picks an option and it is written into
docs/design/.

## The gap in numbers

Counted card by card from the headings of era-1.md, era-2.md and era-3.md (each heading gives the card's side and
Ops). Spread is the number of cards with Ops 1 / 2 / 3 / 4.

| Era                  | LIO cards | SAE cards | Neutral cards | Era total |
| -------------------- | --------- | --------- | ------------- | --------- |
| Era 1 (1991-2001)    | 8         | 13        | 7             | 28        |
| Era 2 (2001-2008)    | 10        | 11        | 8             | 29        |
| Era 3 (2008-2025)    | 8         | 12        | 8             | 28        |
| Eras 1-3             | 26        | 36        | 23            | 85        |
| Future (optional)    | 2         | 2         | 2             | 6         |
| All, future cards in | 28        | 38        | 25            | 91        |

| Era      | LIO spread / total Ops | SAE spread / total Ops | Neutral spread / total Ops | Era total Ops |
| -------- | ---------------------- | ---------------------- | -------------------------- | ------------- |
| Era 1    | 2/4/1/1 / 17           | 3/6/3/1 / 28           | 2/4/1/0 / 13               | 58            |
| Era 2    | 3/5/1/1 / 20           | 3/5/2/1 / 23           | 3/4/1/0 / 14               | 57            |
| Era 3    | 2/5/1/0 / 15           | 3/5/3/1 / 26           | 2/5/1/0 / 15               | 56            |
| Eras 1-3 | 7/14/3/2 / 52          | 9/16/8/3 / 77          | 7/13/3/0 / 42              | 171           |
| Future   | 1/1/0/0 / 3            | 1/1/0/0 / 3            | 1/1/0/0 / 3                | 9             |

The gap, SAE minus LIO: Era 1 +5 cards and +11 Ops; Era 2 +1 card and +3 Ops; Era 3 +4 cards and +11 Ops; Eras
1-3 together +10 cards and +25 Ops. The plan was 13 LIO / 13 SAE / 8 neutral per era with the spread 3/6/3/1 for
each side; the owner's removal of 18 cards (Owner question 8) took 13 from LIO, 3 from SAE and 2 neutral, which is where the
gap comes from.

**The two summary tables in deck-plan.md are one card behind.** "The deck at a glance" and the built "Ops spread"
table still show Era 3 neutral as 7 cards (2/4/1/0), an Era 3 total of 27 and 90 cards in all. They omit
e3-neu-009 "October 7 and Gaza" (neutral, Ops 2), which the owner added later (Owner question 14) and which is in
era-3.md. This file uses the era files' counts: Era 3 neutral 8 cards, 2/5/1/0. Fixing deck-plan.md is outside
this task.

**The Ops 4 cards.** Five exist: Desert Storm Coalition (Era 1 LIO), Handover of Hong Kong (Era 1 SAE), Big Bang
Enlargement 2004 (Era 2 LIO), Olympic Summer 2008 (Era 2 SAE) and Full-Scale Invasion (Era 3 SAE). Era 3 LIO's
strongest card is Chip Chokepoint at Ops 3. The cap stays 4 (Owner question 17); no option below goes above it.

## What the gap does in play

There is one shared draw pile and every hand refills to 8 from it (core-loop.md, "Refilling hands"). So both
sides draw from the same mix, and on average **both hold the same Ops**. The gap shows up somewhere else: in
**whose events happen**. A side holds more of its rival's cards when the rival has more cards, and a rival's card
can only be played for its Ops, with the rival's event still happening; an opening pick of a rival's card resolves
as the rival's event (core-loop.md, "A turn" and "Playing a card"). That is the rival-card dilemma (deck-plan.md),
and today it bites LIO more often than SAE.

Arithmetic done by hand from the counts above (simple proportions; they ignore discards and when each era enters):

- From the 28 Era 1 cards, an 8-card hand holds on average about 3.7 SAE cards and 2.3 LIO cards. So LIO holds
  about 3.7 rival cards and SAE about 2.3.
- From all 85 cards of Eras 1-3, an 8-card hand holds on average about 3.4 SAE cards and 2.4 LIO cards.
- With the plan's 13 / 13 / 7 in Era 1 (33 cards), each side would hold about 3.2 rival cards.

### What the balance tool saw

Command: `node tools/balance/run.mjs --json` (200 games, base seed "balance"). These are Easy AI games of the
TEST scenario `first-deck-test` (4 turns, 1 play each, hand size 8, all placeholders) with **no victory rule**:
every game ended at the turn limit with no winner. The Easy AI does not weigh the rival-card dilemma the way a
person would, so these numbers show how often each side met rival cards, not what a good player would do.

The tool reports picks and plays per card only. The totals below are **arithmetic done by hand**: the per-card
rows summed by the card's side (the `lio`, `sae` or `neu` in its id). They do not appear in the tool's output.

| What the side did (200 games) | LIO cards | SAE cards | Neutral cards | Total |
| ----------------------------- | --------- | --------- | ------------- | ----- |
| LIO opening picks             | 224       | 426       | 150           | 800   |
| SAE opening picks             | 262       | 375       | 163           | 800   |
| LIO plays (event + points)    | 261       | 300       | 239           | 800   |
| SAE plays (event + points)    | 175       | 392       | 233           | 800   |

Read with the caveats above: LIO's opening pick was an SAE card in 426 of 800 picks (53%), so the SAE event
happened; SAE's opening pick was an LIO card in 262 of 800 (33%). LIO played an SAE card for its points 300 times;
SAE played an LIO card for its points 175 times. The Era 3 Ops 4 card, Full-Scale Invasion (e3-sae-004), was
picked 13 times by LIO and 11 times by SAE and never played (same command, its own card row).

## Candidates that are not offered

- **The 18 cards the owner removed** (Owner question 8) are not offered back, under any name: Dayton, NAFTA and
  the WTO, Kosovo Air Campaign, GPS Signal Opened, Peso Bailout, Pokhran and Chagai, Jawbreaker, Colour
  Revolutions, Banco Delta Asia, Gas Cutoff, Argentine Default, Iran: SWIFT Cutoff and the Deal, Shale Revolution,
  Sanctions Wall, Pre-bunking, Salisbury and the Sleuths, Sandworm, Arms Control Unravels.
- **The rows the plan or the owner cut** ("Cut from Notion"; Owner question 21) are not offered either: among them
  the BTC Pipeline, Oklahoma City, 5G and Huawei, the New START / Open Skies rows, Prompt Global Strike, JCPOA,
  Nord Stream, the Olympics rows, BRIC, the separate leak rows, Brexit and Jan 6 as SAE cards, RCEP, Fukushima,
  Yellow Vests, Pegasus, Return of Trump, TPP and Section 301, and the 2021 Belarus border crisis.
- The candidate events named below are only names of real events from 1991-2025. None has Ops, an effect or rules
  text: a card needs a design line the owner approves. They were checked against the era files and the two lists
  above, not against every row in Notion, and the owner's bar ("well known and significant enough", question 8)
  is the owner's to apply.

## Options for the count gap

### Option C1: add new LIO cards

Write new LIO design lines until the counts match or come close: full parity on the era files' counts is 5 more
in Era 1, 1 in Era 2 and 4 in Era 3 (10 cards); a smaller version adds only to Era 1 and Era 3.

Candidate events (names only):

- Era 1: the dissolution of the Soviet Union (December 1991); the Nunn-Lugar threat reduction programme (1991);
  the recognition of Baltic independence (1991); Taiwan's first direct presidential election (1996); the
  East Timor intervention force (1999); the indefinite extension of the Non-Proliferation Treaty (1995).
- Era 2: the fall of the Taliban government (2001); the exposure of the A.Q. Khan network (2004); the Indian
  Ocean tsunami relief effort (2004).
- Era 3: Ukraine's Revolution of Dignity (2014); the defeat of the territorial caliphate (Mosul and Raqqa 2017,
  Baghuz 2019); the Ukraine Defense Contact Group (2022); the first Quad leaders' summit (2021); the Camp David
  trilateral summit of the US, Japan and South Korea (2023).

Possible overlaps to check: Taiwan's 1996 election falls inside the Taiwan Strait Crisis card (SAE); the Soviet
collapse is the backdrop of the whole era and may read better as a scenario start than a card; Era 3 Ukraine
candidates sit next to Annexation of Crimea and Full-Scale Invasion.

Trade-offs:

- **Rival-card dilemma.** Closes it directly: at full parity each side holds about the same number of rival cards
  (about 3.2 each from an Era 1 pile of 13 / 13 / 7). LIO's events happen as often as SAE's.
- **Theme and history.** Era 1 is short of LIO cards although the 1990s are often told as the West's decade; new
  LIO cards could fit that well. The risk is padding with events below the owner's bar, the very reason 13 LIO
  cards were removed.
- **Special ability (X3) and era lengths (X4).** Independent of both. With parity, an ability that pays on rival
  cards would affect both sides about equally; without it, any era-length choice gives Era 1 and Era 3 more turns
  of SAE-heavy hands, which this option removes.
- **Work.** Up to 10 new design lines for the owner (Ops, effect, rules text, history), Notion rows, one content
  task per era (card JSON, a test per card, the scenario's era lists), the ruleset-size notes, the balance numbers
  run again, and golden replays re-recorded because the shuffled pile changes (a code-owned change).
- **Approved cards.** None change.

### Option C2: change the side or Ops of existing approved cards

Move some SAE cards to neutral (narrows the gap by 1 each) or to LIO (by 2 each), or raise the Ops of some LIO
cards so the Ops gap narrows. Cards whose side the owner has already confirmed are left out: Mogadishu, Fall of
Kabul, Abu Ghraib and Invasion of Iraq (question 22), the Hanssen Leak (question 10), and Taiwan Strait, Hainan
and Pristina (question 23). Examples, not choices: cards whose design lines already score for both sides, such as
Shock Therapy Backlash (Era 1), Global Financial Crisis and Eurozone Crisis (Era 3), are the most natural to look
at as neutral.

Trade-offs:

- **Rival-card dilemma.** A card moved to neutral stops being anyone's rival card, so SAE's events fire less
  often; it does not add LIO events. Raising LIO Ops makes LIO cards more tempting for SAE to play for points,
  which makes LIO's events happen more often, without changing the counts.
- **Theme and history.** The weakest fit: the owner placed these cards by which side the event helped
  (question 22's logic). A move needs the event to read as genuinely shared, or the rewrite changes what the
  card says about history.
- **Special ability (X3) and era lengths (X4).** Independent of both. Neutral cards are the lighter part of the
  deck (no Ops 4, one Ops 3 per era); moving an Ops 3 SAE card to neutral breaks that shape.
- **Work.** Each moved or re-costed card needs a new design line and rules text (who chooses and who scores is
  written into the effect), its JSON and test rewritten, Notion updated, and golden replays re-recorded. No new
  card is designed.
- **Approved cards.** Yes: every card it touches is an approved, built card.

### Option C3: keep the gap and say what absorbs it

Leave the counts as they are and name what carries the difference.

- What can absorb it today: the shared draw pile means each side's hand holds the same Ops on average, so the gap
  is only "whose events happen more", not "who has more to spend"; LIO plays first every turn and wins ties on
  opening cards (core-loop.md); Era 2 is already close (10 / 11).
- What could absorb it later, without this option depending on them: a special ability (X3) that helps the side
  holding more rival cards; the scoring (X2) valuing LIO's events more; era lengths (X4) keeping Era 1 or Era 3
  short.

Trade-offs:

- **Rival-card dilemma.** Unchanged: LIO meets SAE cards more often than the reverse (about 3.7 against 2.3 per
  Era 1 hand). That can be a feature, the West reacting to a crowded world, or a balance problem; the balance
  tool cannot say which until there is a victory rule.
- **Theme and history.** Keeps every card the owner approved and every removal the owner made.
- **Special ability (X3) and era lengths (X4).** The most exposed to them: if neither ends up absorbing the gap,
  the question comes back.
- **Work.** Only a sentence in docs/design/ saying the gap is intended, and re-checking once a victory rule
  exists. No content, tests or golden replays change.
- **Approved cards.** None change.

## Options for the missing Era 3 LIO Ops 4 card

### Option F1: a new Era 3 LIO Ops 4 card

Design one new LIO card at Ops 4, a "Hot" card in the deck plan's sense: a strongly one-sided event SAE would
hate to give LIO. It also counts toward Option C1 if that is chosen too.

Candidate events (names only): Ukraine's Revolution of Dignity (2014); the defence of Kyiv (2022); the defeat of
the territorial caliphate (2017-2019). The first two sit close to Annexation of Crimea and Full-Scale Invasion
(whose design already gives LIO 1 at turn end "as the West rallies"); the third has a weaker LIO-against-SAE angle,
since both sides fought it.

Trade-offs:

- **Rival-card dilemma.** Restores the plan's symmetry: Era 3 would again bring one 4-Ops card per side that the
  rival wants for its points and hates for its event. Today no Era 3 card gives SAE that choice.
- **Theme and history.** Era 3 has big LIO-favourable events; the risk is overlap with the Ukraine cards above.
- **Special ability (X3) and era lengths (X4).** Independent of both. Like the other Ops 4 cards it would have no
  once-only rule until W6 (remove a card from the game) is built.
- **Work.** One design line for the owner, a Notion row, one card JSON and test, the scenario's Era 3 list, golden
  replays re-recorded.
- **Approved cards.** None change.

### Option F2: raise an existing Era 3 LIO card to Ops 4

Re-cost one approved Era 3 LIO card to Ops 4. Chip Chokepoint (Ops 3, the strongest today) is the nearest; Fall
of the Assad Regime (Ops 2, LIO 2 and SAE -1 Ops) is the most one-sided event. The deck plan's rule of thumb is
that an event is worth about its Ops, give or take 1, so a bigger Ops number usually needs a bigger event too.

Trade-offs:

- **Rival-card dilemma.** Restores an Era 3 LIO hot card without adding a card. If Chip Chokepoint moves, Era 3
  LIO is left with no Ops 3 card (2/5/0/1), unless another card is raised too.
- **Theme and history.** Depends on the card: export controls as a world-shaking event is arguable; the fall of
  Assad is a sharp blow to SAE but a late (December 2024) and regional one.
- **Special ability (X3) and era lengths (X4).** Independent of both.
- **Work.** A changed design line (Ops, and probably the effect and rules text), the card's JSON and test,
  Notion, golden replays re-recorded. No new card. It also adds 1-2 to LIO's Era 3 Ops (see C2).
- **Approved cards.** Yes, one or two.

### Option F3: keep Era 3 without an LIO Ops 4 card

Accept the asymmetry. Era 3 still has Full-Scale Invasion (SAE, Ops 4) and COVID-19 (neutral, Ops 3) as its big
cards. A variant, which also changes an approved card, is to lower Full-Scale Invasion to Ops 3 so neither side
has an Era 3 Ops 4 card.

Trade-offs:

- **Rival-card dilemma.** Unchanged: of the Era 3 cards, only an SAE card is a 4-Ops rival card. In the balance run above that
  card was never played, only picked, but the Easy AI is no guide to how people treat hot cards. The variant
  removes Era 3's sharpest dilemma for both sides.
- **Theme and history.** Era 3 can be told as SAE's push; the event text carries that, as the plan intended
  ("no era is LIO's era or SAE's era by card count").
- **Special ability (X3) and era lengths (X4).** Independent of both; a short Era 3 (X4) makes the asymmetry
  matter less.
- **Work.** None for the plain version beyond saying so in docs/design/. The variant needs Full-Scale Invasion's
  design line, JSON and test changed and golden replays re-recorded.
- **Approved cards.** None, or one (the variant).

### Options that cover both

C1 plus F1 can be one piece of work: the new Era 3 LIO cards include one at Ops 4. C2 plus F2 likewise: one
re-costing pass over the approved cards. C3 plus F3 is the "change nothing now" pair, to look at again once there
is a victory rule.

## Questions for the owner

1. Is the LIO/SAE gap a balance problem to fix, or part of the setting (Option C3)?
2. If cards are added (C1): full parity in each era (10 cards), or only Era 1 and Era 3? Do any of the candidate
   events meet your "well known and significant enough" bar?
3. Would you change the side or Ops of cards you have already approved (C2, F2), or only add cards?
4. For Era 3: a new LIO Ops 4 card (F1), a re-costed existing card (F2), or no LIO Ops 4 card (F3), and if F3,
   should Full-Scale Invasion stay at Ops 4?
5. Should this wait until there is a victory rule, so the balance tool can measure the gap's effect on results?
6. deck-plan.md's "The deck at a glance" and built "Ops spread" tables omit October 7 and Gaza; may a small task
   correct them?
