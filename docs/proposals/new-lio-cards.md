Proposal, not a rule

# New LIO cards: drafts for the owner's approval

Owner question 51 (deck-plan.md), from the options in [card-count-gap.md](card-count-gap.md) (X5, #176): add new
LIO cards (C1) only for events that meet the owner's "well known and significant enough" bar, and a new Era 3 LIO
Ops 4 card (F1), offered as two or three events for the owner to pick from. Each card is built only once the
owner approves its design line, as for October 7 and Gaza (Owner question 14). Nothing here is built, and nothing
is a rule until the owner says yes and it moves into the era file.

Every draft uses only steps that exist today (deck-plan.md, "Notation used in the era files"). Hot cards follow
the owner's 21 Oct rule (deck-plan.md, wish-list row W5): when the rival plays one, the card's side gets 1 less.
Ops 4 cards are once-only, like the other five (R13). Ids are provisional: each takes the next free
number in its era. No living person is named. The candidates come from card-count-gap.md only; the removed and cut
cards it lists are not offered.

## Questions for the owner

1. **Which event is the Era 3 LIO Ops 4 card?** A, B or C below. Recommend: **A, Defence of Kyiv**, because it is
   the most one-sided LIO event of the era and mirrors Full-Scale Invasion, the SAE Ops 4 card it answers.
2. **Add Revolution of Dignity as an Era 3 Ops 2 card** (if it is not the Ops 4 card)? Recommend: yes.
3. **Add Fall of the Caliphate as an Era 3 Ops 2 card** (if it is not the Ops 4 card)? Recommend: yes.
4. **Add Defence of Kyiv as an Era 3 Ops 2 card** (if it is not the Ops 4 card)? Recommend: yes.
5. **Add End of the Soviet Union** (Era 1, Ops 3)? Recommend: yes.
6. **Add Fall of the Taliban** (Era 2, Ops 3)? Recommend: yes.
7. **Leave out the other candidates** ("Left out" below)? Recommend: yes. Name any you want drafted after all.

Questions 2-4 cover the two events not picked in question 1; the third does not apply.

## Era 3 LIO Ops 4 card: pick one

Each option is a full design line. The two events not picked can still become ordinary cards (questions 2-4).

### Option A: e3-lio-014 · Defence of Kyiv · LIO · Ops 4 · Hot

- **Event:** The armoured columns stall outside the capital, and the invaders pull back from the north.
- **Design:** LIO 2 now and 1 at turn end, and SAE -1 Ops this turn: the quick war fails. Hot: an SAE holder wants
  the 4 Ops but hands LIO the event. If SAE plays it: no SAE -1 Ops (LIO 2 and 1 at turn end). The mirror of
  Full-Scale Invasion (SAE 3, LIO -1 Ops, LIO 1 at turn end).
- **Playable:** `marker "the capital holds"; spend lio 2; if played lio { mod sae -1 min 1 (turn) }; on turnEnd { spend lio 1 }; once-only`
- **Rules text:** Record "the capital holds". LIO spends 2 points. If LIO played this card, until the end of this
  turn, points spent by SAE count 1 less, never below 1. At the end of this turn, LIO spends 1 point. If this
  card's event happens, remove it from the game afterwards.
- **History:** Russian forces advancing from the north in the first days of the invasion of 24 February 2022 were
  stopped short of Kyiv, where a military convoy about 60 kilometres long stalled; by early April 2022 Russia had
  withdrawn from the whole Kyiv region.
- **Overlap:** The same war as Full-Scale Invasion (e3-sae-004), whose turn-end LIO point already stands for "the
  West rallies"; this card is Ukraine's own defence. Cards in an era have no fixed order, so Defence of Kyiv can
  come up before Full-Scale Invasion; its event text stands on its own.
- **Theme:** proxy wars, alliances · **Notion:** create once approved

### Option B: e3-lio-014 · Revolution of Dignity · LIO · Ops 4 · Hot, Split/Gamble (SAE)

- **Event:** Months of protest on Kyiv's Maidan end with the president fleeing to Russia.
- **Design:** LIO 3: Ukraine turns west. SAE may stir unrest in the east, a gamble on SAE's own deck with even odds
  and even stakes: on 4 or more, SAE 2 as the east breaks away; otherwise LIO 2 as the country unites against it.
  An SAE player who is behind gambles; one who is ahead may not. If SAE plays it: LIO 2 instead of 3.
- **Playable:** `marker "turned west"; if played lio { spend lio 3 } else { spend lio 2 }; ask sae "Stir unrest in the east?" -> v; if yes v { draw sae -> d; if d >= 4 { spend sae 2 } else { spend lio 2 } }; once-only`
- **Rules text:** Record "turned west". LIO spends 3 points, or 2 if SAE played this card. SAE chooses: Stir unrest
  in the east? If yes, draw from SAE's Contingency deck, then if the result is 4 or more, SAE spends 2 points;
  otherwise, LIO spends 2 points. If this card's event happens, remove it from the game afterwards.
- **History:** Protests began on Kyiv's Maidan square on 21 November 2013, after Ukraine's government dropped plans
  to sign an association agreement with the European Union. After more than 100 people were killed in February
  2014, the president fled to Russia and parliament removed him on 22 February; Ukraine signed the agreement that
  year.
- **Overlap:** Annexation of Crimea (e3-sae-003) followed within days and is SAE's answer; this card leaves it
  unchanged. Like Defence of Kyiv, it can come up after Crimea.
- **Theme:** populism, alliances · **Notion:** create once approved

### Option C: e3-lio-014 · Fall of the Caliphate · LIO · Ops 4 · Hot, Tempo

- **Event:** The last village of the self-declared caliphate falls, five years after it took Mosul.
- **Design:** LIO 3 and +1 Ops this turn as the coalition's forces are freed for other work. Both sides fought the
  caliphate, so the card reads the lasting "proxy war" tag (Syrian Intervention, W3): if it is recorded, SAE 1 as
  Moscow claims a share of the victory. If SAE plays it: no LIO +1 Ops.
- **Playable:** `marker "caliphate falls"; spend lio 3; if played lio { mod lio +1 (turn) }; if has "proxy war" { spend sae 1 }; once-only`
- **Rules text:** Record "caliphate falls". LIO spends 3 points. If LIO played this card, until the end of this
  turn, points spent by LIO count 1 more. If "proxy war" has been recorded this game, SAE spends 1 point. If this
  card's event happens, remove it from the game afterwards.
- **History:** The Islamic State group took Mosul in June 2014 and declared a caliphate. A US-led coalition formed
  that September backed the forces that retook Mosul in July 2017 and Raqqa in October 2017; its last territory,
  Baghuz in Syria, fell on 23 March 2019.
- **Overlap:** None among the cards. Syrian Intervention (e3-sae-008) sets the tag this card reads; Fall of the
  Assad Regime (e3-lio-013) reads it too. It is the only option outside Ukraine.
- **Theme:** proxy wars, alliances · **Notion:** create once approved

## Era 3 Ops 2 versions of the two events not picked

Smaller versions of the same events: no hot-card rule and not once-only. Each takes the next free Era 3 LIO id.

- **Revolution of Dignity · Ops 2 · Split/Gamble (SAE).** LIO 2; SAE may stir unrest in the east: on 4 or more,
  SAE 1; otherwise LIO 1.
  `marker "turned west"; spend lio 2; ask sae "Stir unrest in the east?" -> v; if yes v { draw sae -> d; if d >= 4 { spend sae 1 } else { spend lio 1 } }`
  Rules text: Record "turned west". LIO spends 2 points. SAE chooses: Stir unrest in the east? If yes, draw from
  SAE's Contingency deck, then if the result is 4 or more, SAE spends 1 point; otherwise, LIO spends 1 point.
- **Fall of the Caliphate · Ops 2 · Plain.** LIO 2; SAE 1 if "proxy war" has been recorded.
  `marker "caliphate falls"; spend lio 2; if has "proxy war" { spend sae 1 }`
  Rules text: Record "caliphate falls". LIO spends 2 points. If "proxy war" has been recorded this game, SAE spends
  1 point.
- **Defence of Kyiv · Ops 2 · Tempo.** LIO 1 and SAE -1 Ops this turn.
  `marker "the capital holds"; spend lio 1; mod sae -1 min 1 (turn)`
  Rules text: Record "the capital holds". LIO spends 1 point. Until the end of this turn, points spent by SAE count
  1 less, never below 1.

Event, history, overlap and theme are as in the Ops 4 option above. If both Ukraine events are added, Era 3 has
four Ukraine cards (with Crimea and Full-Scale Invasion); the 2014-2022 war is the era's main LIO-SAE conflict, so
the drafts accept that, but the owner may prefer one.

## Era 1 and Era 2

### e1-lio-014 · End of the Soviet Union · LIO · Ops 3 · Split (SAE)

- **Event:** The red flag comes down over the Kremlin on Christmas night, and fifteen states take its place.
- **Design:** LIO 2: the rival superpower is gone. SAE chooses: hold the new states together in a commonwealth
  (SAE 1, but SAE -1 Ops this turn as Moscow props them up) or let them go (LIO 1 at turn end as they look west).
- **Playable:** `marker "red flag lowered"; spend lio 2; ask sae "Hold the new states in a commonwealth?" -> v; if yes v { spend sae 1; mod sae -1 min 1 (turn) } else { on turnEnd { spend lio 1 } }`
- **Rules text:** Record "red flag lowered". LIO spends 2 points. SAE chooses: Hold the new states in a
  commonwealth? If yes, SAE spends 1 point, then until the end of this turn, points spent by SAE count 1 less,
  never below 1; if no, at the end of this turn, LIO spends 1 point.
- **History:** The Soviet Union recognised the independence of Estonia, Latvia and Lithuania on 6 September 1991.
  On 8 December the leaders of Russia, Ukraine and Belarus agreed to dissolve the Union and found the Commonwealth
  of Independent States; the Soviet president resigned on 25 December 1991 and the Union ended the next day.
- **Overlap:** The backdrop of the whole era: if the full game's first scenario starts after December 1991, this
  event belongs in its starting position instead (no such scenario exists yet). Budapest Memorandum (e1-lio-002)
  deals with the arsenal left behind and Shock Therapy Backlash (e1-sae-012) with the economy; neither changes.
  The Baltic recognition is folded in here rather than drafted as its own card.
- **Theme:** alliances · **Notion:** create once approved

### e2-lio-014 · Fall of the Taliban · LIO · Ops 3 · Gamble

- **Event:** Special forces on horseback and allied air power drive the Taliban from Kabul in under six weeks.
- **Design:** LIO 2; then a draw from LIO's deck: on 3 or more, a new government takes hold (LIO 1 more);
  otherwise the Taliban regroup across the border and the long war begins (SAE 1).
- **Playable:** `marker "Kabul taken"; spend lio 2; draw lio -> d; if d >= 3 { marker "new government"; spend lio 1 } else { marker "insurgency regroups"; spend sae 1 }`
- **Rules text:** Record "Kabul taken". LIO spends 2 points. Draw from LIO's Contingency deck. If the result is 3 or
  more, record "new government", then LIO spends 1 point; otherwise, record "insurgency regroups", then SAE spends
  1 point.
- **History:** US and British air strikes on Afghanistan began on 7 October 2001. Backed by US special forces and
  air power, the Northern Alliance took Kabul on 13 November, and the Taliban gave up Kandahar, their last
  stronghold, in early December 2001.
- **Overlap:** September 11 (e2-neu-002) and Article 5 Invoked (e2-lio-002) open the same autumn. Fall of Kabul
  (e3-sae-010, 2021) is its mirror twenty years on. Neptune Spear (e3-lio-002) carries the hunt for al-Qaeda's
  leader, so this card's gamble is about the new government, not the leaders.
- **Theme:** proxy wars, alliances · **Notion:** create once approved

## Left out

From card-count-gap.md's candidate list, one line each:

- **Nunn-Lugar threat reduction (1991):** a funding programme few players would know, already named in Budapest
  Memorandum's history.
- **Recognition of Baltic independence (1991):** folded into End of the Soviet Union; on its own it splits one
  event in two.
- **Taiwan's first direct presidential election (1996):** already the occasion of Taiwan Strait Crisis (e1-sae-007),
  whose history names it.
- **East Timor intervention force (1999):** important in the region but less known worldwide than Dayton or the
  Kosovo air campaign, which the owner removed.
- **Indefinite extension of the Non-Proliferation Treaty (1995):** a treaty extension with little public memory;
  Test Ban Treaty and Budapest Memorandum carry arms control.
- **Exposure of the A.Q. Khan network (2004):** it came to light through Libya's disarmament, which Libya Disarms
  (e2-lio-006) already tells; known mostly to specialists.
- **Indian Ocean tsunami relief (2004):** the disaster is well known, its geopolitics is not, and it reads as a
  shared humanitarian event rather than an LIO gain.
- **Ukraine Defense Contact Group (2022):** a meeting format little known by name; allies arming Ukraine is
  Full-Scale Invasion's turn-end point and Defence of Kyiv's story.
- **First Quad leaders' summit (2021):** the Quad is known in the region but the summit is no landmark; AUKUS
  (e3-lio-010, the same year) carries the Indo-Pacific alliances.
- **Camp David summit of the US, Japan and South Korea (2023):** a summit few remember, below the bar the
  removals set.

## The counts if every draft is approved

Questions 1-6 all yes (one Ops 4 card and two Ops 2 cards in Era 3). Spread is Ops 1 / 2 / 3 / 4.

| Era      | LIO cards now -> then | SAE cards | LIO spread then | LIO Ops now -> then | SAE Ops |
| -------- | --------------------- | --------- | --------------- | ------------------- | ------- |
| Era 1    | 8 -> 9                | 13        | 2/4/2/1         | 17 -> 20            | 28      |
| Era 2    | 10 -> 11              | 11        | 3/5/2/1         | 20 -> 23            | 23      |
| Era 3    | 8 -> 11               | 12        | 2/7/1/1         | 15 -> 23            | 26      |
| Eras 1-3 | 26 -> 31              | 36        | 7/16/5/3        | 52 -> 66            | 77      |

The gap narrows from 10 cards to 5. Era 1 stays the shortest (4 cards behind): every Era 1 candidate but one is
left out above, so closing it further needs events the owner names.

## Work once approved

Per approved card: the design line moved into its era file, a Notion row, the card JSON, a test with one assertion
per branch (content rules), and the scenario's era list. Then the deck-plan tables and the ruleset-size notes are
updated, the balance numbers run again, and golden replays re-recorded because the shuffled pile changes (a
code-owned change). One content task per era.
