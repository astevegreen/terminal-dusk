# Era 1 cards: 1991 to 2001 (the Cold War's end to 9/11)

Part of the [deck plan](deck-plan.md). Notation, rules-text templates and the wish-list codes (W1-W8) are
defined there. Every card: LIO 8, SAE 13, neutral 7 (the plan had 13, 13 and 8; the owner removed the rest as not well known or significant enough, and their numbers stay unused). Era string in JSON: `"era-1"`. Era 1 is the
starting deck: the turn 1 refill deals both hands from it, so it must hold at least 2 x the hand size (16 cards).

## LIO (8)

### e1-lio-001 · Maastricht Treaty · LIO · Ops 2 · Tempo

- **Event:** Twelve states found the European Union and promise a single currency.
- **Design:** LIO 1 and +1 Ops this turn; a lasting "union" tag that Euro Cash and Big Bang build on (W1, W3).
- **Playable:** `marker "union founded"; spend lio 1; mod lio +1 (turn)`
- **History:** The Treaty on European Union was signed at Maastricht on 7 February 1992 and entered into force on 1 November 1993, creating the European Union and the path to a single currency.
- **Theme:** alliances · **Notion:** update `3fceb012942f811086dde641d138fee3`

### e1-lio-002 · Budapest Memorandum · LIO · Ops 2 · Split (SAE)

- **Event:** Ukraine gives up the world's third-largest nuclear arsenal for security assurances.
- **Design:** LIO 2; SAE chooses to honour the assurances (SAE 1, a "promise kept" tag) or treat them as paper (LIO 1 more now; a "hollow assurance" tag Crimea would cash in, W3).
- **Playable:** `marker "assurances given"; spend lio 2; ask sae "Honour the assurances?" -> v; if yes v { marker "promise kept"; spend sae 1 } else { marker "hollow assurance"; spend lio 1 }`
- **History:** On 5 December 1994 Ukraine, Kazakhstan and Belarus received security assurances from the United States, the United Kingdom and Russia in the Budapest Memorandum, in return for giving up Soviet nuclear weapons left on their territory. US Nunn-Lugar funding paid for much of the dismantling.
- **Theme:** alliances, arms · **Notion:** update `3fceb012942f817a8e02cd42a2327bba`

### e1-lio-004 · NATO Enlargement 1999 · LIO · Ops 3 · Split/Gamble (SAE)

- **Event:** Poland, Hungary and the Czech Republic join the alliance.
- **Design:** LIO 2; SAE may protest loudly: usually it only confirms the newcomers' choice (SAE pays 2 to LIO's draw) but sometimes it rattles the alliance (LIO loses tempo). A lasting "enlargement" tag (W1).
- **Playable:** `marker "enlargement"; spend lio 2; ask sae "Protest the enlargement?" -> v; if yes v { draw lio -> d; if d <= 3 { spend sae 2 } else { spend lio 1 } } else { spend lio 1 }`
  (SAE's "yes" is a gamble: on a low draw SAE scores 2, on a high draw LIO scores 1 more.)
- **History:** Poland, Hungary and the Czech Republic became NATO members on 12 March 1999 at a ceremony in Independence, Missouri, the first enlargement since the Cold War.
- **Theme:** alliances · **Notion:** update `3fceb012942f81528f67f03656d2a2e8` (was "Visegrád NATO Enlargement"; Slovakia joined only in 2004)

### e1-lio-006 · Desert Storm Coalition · LIO · Ops 4 · Hot

- **Event:** A 34-nation coalition frees Kuwait in six weeks.
- **Design:** LIO 3 and SAE -1 Ops this turn: the unipolar moment. Hot: an SAE holder wants 4 Ops but hands LIO the event.
- **Playable:** `marker "coalition victory"; spend lio 3; mod sae -1 min 1 (turn)`
- **History:** Operation Desert Storm began on 17 January 1991 and ended with a ceasefire on 28 February 1991; a coalition of some 34 nations under a UN mandate expelled Iraqi forces from Kuwait.
- **Theme:** alliances, proxy wars · **Notion:** create

### e1-lio-010 · Arrest of Aldrich Ames · LIO · Ops 2 · Gamble

- **Event:** The CIA catches its own counter-intelligence officer after nine years of betrayal.
- **Design:** LIO 1 for the arrest; then the damage assessment: either the network is rebuilt (LIO 1 more) or the losses were already fatal (SAE 1).
- **Playable:** `marker "mole exposed"; spend lio 1; draw lio -> d; if d >= 4 { spend lio 1 } else { spend sae 1 }`
- **History:** Aldrich Ames, a CIA counter-intelligence officer, was arrested on 21 February 1994 after nine years of spying for the Soviet Union and Russia; his betrayal exposed many Western agents.
- **Theme:** gray-zone, intelligence · **Notion:** update `3fceb012942f8116b044c7a78f26fddf` (side changed from SAE to LIO: the arrest is LIO's win; see Owner questions)

### e1-lio-011 · Dot-com Boom · LIO · Ops 2 · Tempo

- **Event:** A browser company's share price doubles on day one and the web goes mainstream.
- **Design:** LIO 1 now and 1 more after every card played this turn, by either side: network effects. (The engine's cardPlayed trigger fires for both sides' plays, W2.)
- **Playable:** `marker "network effect"; spend lio 1; on cardPlayed (turn) { spend lio 1 }`
- **History:** Netscape's initial public offering on 9 August 1995 saw its shares more than double on the first day of trading and is often taken as the start of the dot-com boom.
- **Theme:** technology, information · **Notion:** create

### e1-lio-012 · Partnership for Peace · LIO · Ops 1 · Split (SAE)

- **Event:** NATO offers the old enemies a partnership, not membership.
- **Design:** LIO 1; SAE may join (SAE 1, a "partner" tag) or stay out (SAE -1 Ops this turn as it isolates itself).
- **Playable:** `marker "partners, not members"; spend lio 1; ask sae "Join the partnership?" -> v; if yes v { spend sae 1 } else { mod sae -1 min 1 (turn) }`
- **History:** NATO launched the Partnership for Peace at its Brussels summit on 10-11 January 1994, open to former Warsaw Pact states and Soviet republics; Russia signed the framework document on 22 June 1994.
- **Theme:** alliances · **Notion:** create

### e1-lio-013 · Oslo Accords · LIO · Ops 1 · Split (SAE)

- **Event:** A handshake on the White House lawn promises peace in the Middle East.
- **Design:** LIO 1; SAE may back the spoilers (SAE 1 now, but LIO 1 at turn end as the broker rallies support) or stay out (LIO 1 more).
- **Playable:** `marker "handshake"; spend lio 1; ask sae "Back the spoilers?" -> v; if yes v { spend sae 1; on turnEnd { spend lio 1 } } else { spend lio 1 }`
- **History:** Israel and the Palestine Liberation Organization signed the Oslo Declaration of Principles at the White House on 13 September 1993, setting out a framework for Palestinian self-government.
- **Theme:** proxy wars, alliances · **Notion:** create

## SAE (13)

### e1-sae-001 · Battle of Mogadishu · SAE · Ops 2 · Hold

- **Event:** Eighteen US soldiers die in one night and the appetite for intervention dies with them.
- **Design:** SAE 1 now and 1 at turn end; an "intervention fatigue" tag that the Rwanda card would read (W3).
- **Playable:** `marker "intervention fatigue"; spend sae 1; on turnEnd { spend sae 1 }`
- **History:** On 3-4 October 1993 a US raid in Mogadishu, Somalia turned into a day-long battle in which 18 US soldiers were killed; US forces withdrew from Somalia by March 1994.
- **Theme:** proxy wars · **Notion:** update `3fceb012942f812a8826d4661acad5d6` (was "Black Hawk Down", a film title)

### e1-sae-002 · Handover of Hong Kong · SAE · Ops 4 · Hot

- **Event:** The Union flag comes down over a territory promised fifty years of autonomy.
- **Design:** SAE 3; a "promise made" tag that the 2020 security law card closes (W1, W3). Hot: 4 Ops tempts LIO holders.
- **Playable:** `marker "one country, two systems"; spend sae 3`
- **History:** Britain returned Hong Kong to China on 1 July 1997; under the 1990 Basic Law the territory was promised a high degree of autonomy for fifty years, to 2047.
- **Theme:** alliances, gray-zone · **Notion:** update `3fceb012942f8143974df5a9772fb204`

### e1-sae-003 · Golden Shield · SAE · Ops 2 · Tempo

- **Event:** China starts building the wall around its internet.
- **Design:** SAE 1 now and 1 after every card played this turn (both sides' plays, W2): control compounds.
- **Playable:** `marker "walled network"; spend sae 1; on cardPlayed (turn) { spend sae 1 }`
- **History:** China's Ministry of Public Security launched the Golden Shield project in 1998; the filtering and surveillance system, widely known as the Great Firewall, was operational by 2003.
- **Theme:** cyber, information · **Notion:** update `3fceb012942f81e2827be465891b3789`

### e1-sae-004 · Second Chechen War · SAE · Ops 3 · Hot

- **Event:** A new prime minister wins a war and the presidency in seven months.
- **Design:** SAE 3: power consolidated. A "strongman" tag (W1).
- **Playable:** `marker "consolidation"; spend sae 3`
- **History:** Russia's second war in Chechnya began with fighting in Dagestan in August 1999 and a ground offensive on 1 October 1999; Vladimir Putin, appointed acting prime minister on 9 August 1999 and acting president on 31 December 1999, won the presidential election on 26 March 2000.
- **Theme:** proxy wars, populism · **Notion:** update `3fceb012942f81f6b6c9c3534e43b1a2`

### e1-sae-005 · The Hanssen Leak · SAE · Ops 2 · Gamble

- **Event:** An FBI agent sells secrets for two decades before he is caught.
- **Design:** SAE 2 for the intelligence; a small chance the mole is caught early (LIO 1).
- **Playable:** `marker "mole inside"; spend sae 2; draw sae -> d; if d <= 2 { marker "mole caught"; spend lio 1 }`
- **History:** FBI agent Robert Hanssen was arrested on 18 February 2001 after spying for the Soviet Union and Russia on and off since 1979; he was sentenced to life imprisonment.
- **Theme:** gray-zone, intelligence · **Notion:** update `3fceb012942f81fd8aafecba4f2e3341`

### e1-sae-006 · Shanghai Five · SAE · Ops 3 · Hold

- **Event:** Russia and China turn a border talk into a bloc.
- **Design:** SAE 2 now and 1 at turn end; the entente's founding tag (W1).
- **Playable:** `marker "entente formed"; spend sae 2; on turnEnd { spend sae 1 }`
- **History:** China, Russia, Kazakhstan, Kyrgyzstan and Tajikistan formed the Shanghai Five at a summit on 26 April 1996; with Uzbekistan they founded the Shanghai Cooperation Organisation on 15 June 2001.
- **Theme:** alliances · **Notion:** create

### e1-sae-007 · Taiwan Strait Crisis · SAE · Ops 3 · Split (LIO)

- **Event:** Missiles splash near Taiwan before its first direct presidential election.
- **Design:** LIO decides: send the carriers (LIO 2 but -1 Ops this turn, forces stretched) or stay out (SAE 3, intimidation works).
- **Playable:** `marker "strait crisis"; ask lio "Send the carriers?" -> v; if yes v { spend lio 2; mod lio -1 min 1 (turn) } else { spend sae 3 }`
- **History:** China fired missiles into waters near Taiwan and held exercises from July 1995 to March 1996, ahead of Taiwan's first direct presidential election on 23 March 1996; the United States sent two aircraft-carrier groups to the area in March 1996.
- **Theme:** gray-zone, alliances · **Notion:** create

### e1-sae-008 · Primakov's U-turn · SAE · Ops 1 · Opener

- **Event:** Russia's prime minister turns his plane around over the Atlantic as the bombs fall on Belgrade.
- **Design:** LIO -1 Ops this turn: the partnership of the 1990s is over.
- **Playable:** `marker "turn over the Atlantic"; mod lio -1 min 1 (turn)`
- **History:** On 24 March 1999 Russian prime minister Yevgeny Primakov, flying to Washington, ordered his plane to turn back over the Atlantic when told that NATO's bombing of Yugoslavia was about to begin.
- **Theme:** alliances · **Notion:** create

### e1-sae-009 · Belgrade Embassy Bombing · SAE · Ops 2 · Gamble

- **Event:** NATO bombs hit the Chinese embassy and Chinese cities erupt.
- **Design:** Usually a propaganda windfall (SAE 3); sometimes the apology lands and the anger fades (LIO 1).
- **Playable:** `marker "embassy hit"; draw sae -> d; if d >= 3 { spend sae 3 } else { spend lio 1 }`
- **History:** On 7 May 1999 NATO aircraft bombed the Chinese embassy in Belgrade, killing three Chinese journalists; the United States called it a targeting error and paid compensation, and large anti-US protests followed in China.
- **Theme:** information, alliances · **Notion:** create

### e1-sae-010 · Hainan Island Incident · SAE · Ops 1 · Split (LIO)

- **Event:** A US spy plane and a Chinese fighter collide; 24 crew are held for eleven days.
- **Design:** SAE 1; LIO may say sorry (LIO 1, the crew comes home) or refuse (LIO keeps face, +1 Ops this turn, but SAE 1 more).
- **Playable:** `marker "collision"; spend sae 1; ask lio "Say sorry?" -> v; if yes v { spend lio 1 } else { mod lio +1 (turn); spend sae 1 }`
- **History:** On 1 April 2001 a US Navy EP-3 reconnaissance aircraft collided with a Chinese fighter near Hainan Island; the Chinese pilot died and the 24 US crew were held for eleven days until a carefully worded US letter was accepted.
- **Theme:** gray-zone · **Notion:** create

### e1-sae-011 · Pristina Airport Dash · SAE · Ops 1 · Split/Gamble (LIO)

- **Event:** Russian paratroopers seize Kosovo's airport hours before NATO arrives.
- **Design:** SAE 1; LIO may confront them: a gamble between a backdown (SAE 2) and a face-off that LIO wins (LIO 2); or let it pass.
- **Playable:** `marker "airport seized"; spend sae 1; ask lio "Confront them?" -> v; if yes v { draw sae -> d; if d >= 4 { spend sae 2 } else { spend lio 2 } } else { marker "stand-off avoided" }`
- **History:** On 12 June 1999 around 200 Russian paratroopers drove from Bosnia to occupy Pristina airport in Kosovo ahead of NATO forces; NATO's commander refused an order to block them and the stand-off was resolved by negotiation.
- **Theme:** gray-zone · **Notion:** create

### e1-sae-012 · Shock Therapy Backlash · SAE · Ops 2 · Split (LIO)

- **Event:** Prices are freed, savings vanish and tanks shell the parliament.
- **Design:** SAE 2 as reform curdles into resentment; LIO may fund the reformers (LIO 1, but SAE 1 at turn end as the money is blamed too).
- **Playable:** `marker "reform backlash"; spend sae 2; ask lio "Fund the reformers?" -> v; if yes v { spend lio 1; on turnEnd { spend sae 1 } } else { marker "left to themselves" }`
- **History:** Russia freed most prices in January 1992 and inflation wiped out savings; the confrontation between president and parliament ended when tanks shelled the parliament building on 4 October 1993.
- **Theme:** finance, populism · **Notion:** create

### e1-sae-013 · Cox Report · SAE · Ops 2 · Gamble

- **Event:** Congress says China stole designs for every deployed US warhead.
- **Design:** The designs are copied (SAE 2) or the ring is exposed and security tightens (LIO 1).
- **Playable:** `marker "designs copied"; draw sae -> d; if d >= 3 { spend sae 2 } else { marker "ring exposed"; spend lio 1 }`
- **History:** The US congressional Cox Report, released on 25 May 1999, alleged that China had obtained design information on US nuclear warheads through espionage over two decades.
- **Theme:** gray-zone, arms · **Notion:** create

## Neutral (7)

These neutral cards were built before neutral cards could draw a Contingency card (allowed since #126; see Owner
question 1), so they use choices instead. Redesigns that use draws are a follow-up pull request.

### e1-neu-001 · Rwandan Genocide · neutral · Ops 2 · Swing (both)

- **Event:** Radio calls for murder for a hundred days and the world looks away.
- **Design:** Both sides -1 Ops this turn: nobody comes out of this with credit. Would read the "intervention fatigue" tag (W3).
- **Playable:** `marker "the world looks away"; mod both -1 min 1 (turn)`
- **History:** Between April and July 1994 an estimated 500,000 to 800,000 people, mostly Tutsi, were killed in Rwanda; the radio station RTLM, broadcasting from July 1993, incited the killings.
- **Theme:** information, proxy wars · **Notion:** update `3fceb012942f814cbb1af8b0cbd59a9e` (RTLM row folded in)

### e1-neu-002 · Asian Financial Crisis · neutral · Ops 3 · Split (both)

- **Event:** The Thai baht falls and the "miracle" economies follow.
- **Design:** Each side chooses whether to bail out its partners: a bailout scores 2 but costs 1 Ops this turn; standing aside scores nothing. Then one draw from the deck of the side that played the card (owner, 21 Oct, R9 option B). On 3 or more, contagion spreads: each side that stood aside gives the rival 1 at turn end. Otherwise it is contained: no turn-end points.
- **Playable:** `marker "contagion"; ask both "Bail out your partners?" -> v; draw player -> d; if yes v[lio] { spend lio 2; mod lio -1 min 1 (turn) } else { if d >= 3 { on turnEnd { spend sae 1 } } }; if yes v[sae] { spend sae 2; mod sae -1 min 1 (turn) } else { if d >= 3 { on turnEnd { spend lio 1 } } }`
- **History:** Thailand floated the baht on 2 July 1997 and the crisis spread to Indonesia, South Korea and beyond; IMF-led rescue packages for the three countries together exceeded $100 billion.
- **Theme:** finance · **Notion:** update `3fceb012942f81b481a1cfad9e3915ae`

### e1-neu-003 · Ruble Default · neutral · Ops 2 · Split (SAE)

- **Event:** Russia defaults on its own debt and a Wall Street fund nearly takes the system down.
- **Design:** SAE decides: default or keep paying (LIO 1 as the lenders are made whole). A default draws from the deck of the side that played the card (owner, 21 Oct, R9 option B): on 3 or more, SAE 2 but -1 Ops this turn, the state resets; otherwise the reset fails: SAE -1 Ops only.
- **Playable:** `marker "default"; ask sae "Default?" -> v; if yes v { draw player -> d; if d >= 3 { spend sae 2; mod sae -1 min 1 (turn) } else { mod sae -1 min 1 (turn) } } else { spend lio 1 }`
- **History:** On 17 August 1998 Russia devalued the ruble and defaulted on its domestic debt; the shock led to the $3.6 billion rescue of the hedge fund Long-Term Capital Management in September 1998.
- **Theme:** finance · **Notion:** update `3fceb012942f81788030deb4c013ea60`

### e1-neu-004 · Test Ban Treaty · neutral · Ops 2 · Split (both, stag hunt)

- **Event:** The world agrees to stop testing nuclear weapons, if everyone signs.
- **Design:** Both ratify: 2 each and the treaty is in force. One ratifies alone: the other free-rides for 1. Neither: 1 each and the treaty stalls. Trust pays; defection is safe.
- **Playable:** `ask both "Ratify?" -> v; if yes v[lio] { if yes v[sae] { marker "treaty in force"; spend lio 2; spend sae 2 } else { spend sae 1 } } else { if yes v[sae] { spend lio 1 } else { marker "treaty stalled"; spend lio 1; spend sae 1 } }`
- **History:** The Comprehensive Nuclear-Test-Ban Treaty opened for signature on 24 September 1996; the US Senate rejected ratification on 13 October 1999 and the treaty has never entered into force.
- **Theme:** arms · **Notion:** update `3fceb012942f8133a5eacd533718fe5e`

### e1-neu-006 · Al Jazeera Launches · neutral · Ops 1 · Opener

- **Event:** A satellite channel from Doha breaks the West's monopoly on the news.
- **Design:** LIO -1 Ops this turn: the information space gets a new voice.
- **Playable:** `marker "new voice"; mod lio -1 min 1 (turn)`
- **History:** Al Jazeera began broadcasting from Doha, Qatar on 1 November 1996 as the first independent Arabic-language satellite news channel.
- **Theme:** information · **Notion:** update `3fceb012942f81a7ae43d0118efec22e`

### e1-neu-007 · First Crew on the ISS · neutral · Ops 1 · Opener

- **Event:** An American and two Russians move into a station built by both.
- **Design:** +1 Ops for both this turn: cooperation lifts everyone.
- **Playable:** `marker "crew aboard"; mod both +1 (turn)`
- **History:** Expedition 1, one American and two Russian crew members, arrived at the International Space Station in November 2000 and began continuous human occupation of the station.
- **Theme:** space · **Notion:** update `3fceb012942f81d0b641cea4155c452d`

### e1-neu-008 · Kyoto Protocol · neutral · Ops 2 · Split (both)

- **Event:** Rich countries promise to cut emissions; the biggest one never ratifies.
- **Design:** Each side: commit or stay out (nothing). Then one draw from the deck of the side that played the card (owner, 21 Oct, R9 option B). On 3 or more, the commitments hold: each side that committed scores 1, but -1 Ops this turn as the costs bite. Otherwise ratification stalls: each side that committed takes -1 Ops but scores nothing.
- **Playable:** `marker "targets set"; ask both "Commit to the targets?" -> v; draw player -> d; if yes v[lio] { if d >= 3 { spend lio 1 }; mod lio -1 min 1 (turn) }; if yes v[sae] { if d >= 3 { spend sae 1 }; mod sae -1 min 1 (turn) }`
- **History:** The Kyoto Protocol was adopted on 11 December 1997 and entered into force on 16 February 2005; the United States signed it in 1998 but never ratified it.
- **Theme:** climate · **Notion:** create

## Stage 2 build notes

All 28 cards are built as `packages/content/cards/era-1/<id>.json`, each with a test that plays it in the real engine
and checks every branch. The rules text of each file is written from the JSON and says what it does today.

- **Neutral cards (all 7): the event is built but cannot run in a game yet.** The engine still lets a neutral card
  be played for points only (a TEMPORARY rule in the engine, written before neutral events were designed), and it
  keeps neutral cards out of opening picks. core-loop.md says neutral cards have events. The JSON holds the intended
  effect and its tests run it as if the card were LIO's; in a real game the event stays dormant. See Owner question 26.
  **Since lifted (Owner question 26):** the engine now runs neutral events and lets a neutral card open, and the
  tests play each neutral card as the neutral card it is.
- **Ops swings: "points spent", not "plays for points".** An opsValue modifier changes every point spent while it lasts
  (including points spent by other effects), not only points from playing a card for points. The rules text
  says "points spent by <side> count N more". See Owner question 28.
