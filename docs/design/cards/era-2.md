# Era 2 cards: 2001 to 2008 (9/11 to the crash)

Part of the [deck plan](deck-plan.md). Notation, rules-text templates and the wish-list codes (W1-W8) are
defined there. Every card: LIO 10, SAE 11, neutral 8 (the plan had 13, 13 and 8; the owner removed the rest as not well known or significant enough, and their numbers stay unused). Era string in JSON: `"era-2"`.

## LIO (10)

### e2-lio-002 · Article 5 Invoked · LIO · Ops 1 · Opener

- **Event:** NATO declares the attack on one an attack on all, for the first time ever.
- **Design:** Allies rally: LIO 1 and +1 Ops this turn.
- **Playable:** `marker "allies rally"; spend lio 1; mod lio +1 (turn)`
- **History:** NATO invoked Article 5 of its founding treaty for the first time after the 11 September 2001 attacks, provisionally on 12 September and definitively on 2 October 2001.
- **Theme:** alliances · **Notion:** create

### e2-lio-004 · ABM Treaty Withdrawal · LIO · Ops 2 · Split (LIO)

- **Event:** Washington leaves the 1972 missile-defence treaty to build interceptors.
- **Design:** LIO decides: leave (LIO 2, but SAE 1 as Moscow gains a grievance) or stay (LIO 1).
- **Playable:** `ask lio "Leave the treaty?" -> v; if yes v { marker "treaty gone"; spend lio 2; spend sae 1 } else { spend lio 1 }`
- **History:** The United States gave notice of withdrawal from the 1972 Anti-Ballistic Missile Treaty on 13 December 2001; the withdrawal took effect on 13 June 2002.
- **Theme:** alliances, arms · **Notion:** update `3fceb012942f81a8b2f5dc9d24719954`

### e2-lio-006 · Libya Disarms · LIO · Ops 2 · Plain

- **Event:** Tripoli hands over its nuclear and chemical programmes.
- **Design:** LIO 2; sets a "disarmament bargain" tag that a later intervention card would break (W3).
- **Playable:** `marker "programme surrendered"; spend lio 2`
- **History:** On 19 December 2003 Libya announced it would give up its nuclear, chemical and long-range missile programmes and admit international inspectors.
- **Theme:** arms, sanctions · **Notion:** create

### e2-lio-007 · Big Bang Enlargement 2004 · LIO · Ops 4 · Hot

- **Event:** Seven states join NATO and ten join the EU within five weeks.
- **Design:** LIO 3 now and 1 at turn end; the permanent eastward shift (W1). Hot: an SAE holder wants the 4 Ops but hates the event.
- **Playable:** `marker "eastward"; spend lio 3; on turnEnd { spend lio 1 }`
- **History:** Seven countries, including the three Baltic states, joined NATO on 29 March 2004, and ten countries joined the European Union on 1 May 2004.
- **Theme:** alliances · **Notion:** create

### e2-lio-008 · Smartphones and Social Networks · LIO · Ops 2 · Swing (both)

- **Event:** Always-on pocket computers and social platforms reach ordinary people.
- **Design:** LIO 1; everyone's reach grows: +1 Ops for both sides this turn. Later information cards key off a "platforms" tag (W3).
- **Playable:** `marker "everyone is connected"; spend lio 1; mod both +1 (turn)`
- **History:** Apple's first iPhone went on sale on 29 June 2007, and social networks grew rapidly in the same years, putting always-on communication into ordinary hands.
- **Theme:** AI and technology, information · **Notion:** create

### e2-lio-009 · Ana Montes Unmasked · LIO · Ops 1 · Opener

- **Event:** A senior Pentagon analyst is arrested as a long-serving foreign agent.
- **Design:** Counter-intelligence win: LIO 1 and SAE -1 Ops this turn. (Montes spied for Cuba, not the SAE blocs; see Owner questions.)
- **Playable:** `marker "mole exposed"; spend lio 1; mod sae -1 min 1 (turn)`
- **History:** Ana Montes, a senior analyst at the US Defense Intelligence Agency, was arrested on 21 September 2001 for spying for Cuba; she was sentenced to 25 years and released in January 2023.
- **Theme:** gray-zone, intelligence · **Notion:** update `3fceb012942f811192b5ffd6b6fc82de`

### e2-lio-010 · PEPFAR · LIO · Ops 2 · Split (SAE)

- **Event:** A $15 billion US programme puts millions on HIV treatment.
- **Design:** LIO 1; SAE may match it (SAE 1 but -1 Ops, the money has to come from somewhere) or let LIO take the credit (LIO 1 more).
- **Playable:** `marker "clinics open"; spend lio 1; ask sae "Match it with your own aid?" -> v; if yes v { spend sae 1; mod sae -1 min 1 (turn) } else { spend lio 1 }`
- **History:** The US President's Emergency Plan for AIDS Relief was announced on 28 January 2003 with $15 billion over five years for treatment and prevention, mainly in Africa.
- **Theme:** pandemics · **Notion:** create

### e2-lio-011 · Cedar Revolution · LIO · Ops 2 · Split/Gamble (SAE)

- **Event:** A million Lebanese march and Syrian troops leave after 29 years.
- **Design:** SAE may back the old order: a gamble that pays SAE 2 or hands LIO 2; or it steps back and LIO takes 1.
- **Playable:** `marker "troops out"; ask sae "Back the old order?" -> v; if yes v { draw lio -> d; if d >= 4 { spend sae 2 } else { spend lio 2 } } else { spend lio 1 }`
- **History:** Mass protests in Lebanon after the assassination of former prime minister Rafik Hariri on 14 February 2005 led to the withdrawal of Syrian troops by the end of April 2005.
- **Theme:** populism and elections, proxy wars · **Notion:** create

### e2-lio-012 · Euro Cash · LIO · Ops 1 · Hold

- **Event:** Twelve countries swap their notes and coins for the euro overnight.
- **Design:** LIO 1 now and 1 at turn end; a lasting "single currency" tag (W1).
- **Playable:** `marker "single currency"; spend lio 1; on turnEnd { spend lio 1 }`
- **History:** Euro notes and coins entered circulation on 1 January 2002 in twelve EU countries with around 300 million people.
- **Theme:** sanctions and finance · **Notion:** create

### e2-lio-013 · India-US Nuclear Deal · LIO · Ops 3 · Split (SAE)

- **Event:** Washington brings India in from the nuclear cold.
- **Design:** LIO 2; SAE may court India too (SAE 1 but -1 Ops this turn) or concede the partner (LIO 1 more).
- **Playable:** `marker "new partner"; spend lio 2; ask sae "Court India too?" -> v; if yes v { spend sae 1; mod sae -1 min 1 (turn) } else { spend lio 1 }`
- **History:** The United States and India announced a civil nuclear cooperation initiative on 18 July 2005; the Nuclear Suppliers Group granted India a waiver on 6 September 2008 and the bilateral "123 Agreement" was signed on 10 October 2008.
- **Theme:** alliances · **Notion:** create

## SAE (11)

### e2-sae-001 · Invasion of Iraq · SAE · Ops 3 · Hot

- **Event:** The coalition splits over a war sold on weapons that were not there.
- **Design:** SAE 2 and LIO -1 Ops this turn; a lasting "credibility" tag that Curveball and Abu Ghraib deepen (W1, W3).
- **Playable:** `marker "coalition fractures"; spend sae 2; mod lio -1 min 1 (turn)`
- **History:** A US-led coalition invaded Iraq on 20 March 2003 and took Baghdad on 9 April 2003. The stated justification, Iraqi weapons of mass destruction, was not borne out.
- **Theme:** proxy wars, alliances · **Notion:** update `3fceb012942f8154b177c1f3c802bbf5`

### e2-sae-002 · Curveball · SAE · Ops 2 · Split/Gamble (LIO)

- **Event:** A single defector's story about mobile weapons labs goes to the UN.
- **Design:** LIO may act on the single source: usually it is discredited (SAE 1, LIO -1 Ops), sometimes it holds (LIO 2); or LIO waits for corroboration and takes 1.
- **Playable:** `ask lio "Act on the single source?" -> v; if yes v { draw sae -> d; if d >= 3 { marker "intelligence discredited"; spend sae 1; mod lio -1 min 1 (turn) } else { spend lio 2 } } else { spend lio 1 }`
- **History:** Claims that Iraq had mobile biological-weapons laboratories, presented to the UN Security Council on 5 February 2003, rested largely on an informant code-named Curveball whose account was later found to be fabricated.
- **Theme:** information warfare · **Notion:** update `3fceb012942f81769467daeda3b33918`

### e2-sae-003 · Olympic Summer 2008 · SAE · Ops 4 · Hot

- **Event:** Beijing opens the Games while Russian tanks roll into Georgia.
- **Design:** SAE 3 and +1 Ops this turn: confidence at its peak. Hot: LIO holders want the 4 Ops.
- **Playable:** `marker "summer of 2008"; spend sae 3; mod sae +1 (turn)`
- **History:** The Beijing Olympics opened on 8 August 2008; the same week, Russian forces fought a five-day war with Georgia that ended in a ceasefire brokered by France.
- **Theme:** gray-zone, proxy wars · **Notion:** update `3fceb012942f81b2a70ace2419b7112e`

### e2-sae-004 · Estonian Cyberattacks 2007 · SAE · Ops 1 · Gamble

- **Event:** A row over a Soviet war memorial knocks a whole country's websites offline.
- **Design:** The attack lands (SAE 2) or hardens the target (LIO 1 and a cyber-defence tag, W3).
- **Playable:** `draw sae -> d; if d >= 3 { marker "sites down"; spend sae 2 } else { marker "cyber defence doctrine"; spend lio 1 }`
- **History:** From 27 April 2007 Estonian government, bank and media websites were hit by weeks of denial-of-service attacks after a dispute over moving a Soviet war memorial in Tallinn.
- **Theme:** cyber · **Notion:** update `3fceb012942f8102bdc6cfe489750ff1`

### e2-sae-005 · Litvinenko Poisoning · SAE · Ops 1 · Split (LIO)

- **Event:** A defector dies of polonium in a London hospital.
- **Design:** SAE 1; LIO may expel diplomats (LIO 1 now, SAE 1 at turn end as the feud deepens) or let it pass.
- **Playable:** `marker "polonium"; spend sae 1; ask lio "Expel diplomats?" -> v; if yes v { spend lio 1; on turnEnd { spend sae 1 } } else { marker "unanswered" }`
- **History:** Former Russian officer Alexander Litvinenko fell ill in London on 1 November 2006 and died on 23 November from polonium-210 poisoning; in 2021 the European Court of Human Rights found Russia responsible.
- **Theme:** gray-zone · **Notion:** update `3fceb012942f81d58bdec2e6d2fb0185`

### e2-sae-007 · North Korean Nuclear Test · SAE · Ops 2 · Gamble

- **Event:** Pyongyang leaves the NPT and sets off its first bomb.
- **Design:** A three-way draw: big success (SAE 2), fizzle (SAE 1) or a backlash that unites LIO (LIO 1).
- **Playable:** `marker "first test"; draw sae -> d; if d >= 4 { spend sae 2 } else { if d <= 2 { spend lio 1 } else { spend sae 1 } }`
- **History:** North Korea announced its withdrawal from the Non-Proliferation Treaty in January 2003 and conducted its first nuclear test on 9 October 2006.
- **Theme:** arms, proxy · **Notion:** update `3fceb012942f81f2abe5c87e24d373c1`

### e2-sae-008 · Petrocaribe · SAE · Ops 2 · Hold

- **Event:** Cheap Venezuelan oil buys friends as the US free-trade area dies.
- **Design:** SAE 2 now; LIO 1 at turn end as the subsidies bite.
- **Playable:** `marker "oil diplomacy"; spend sae 2; on turnEnd { spend lio 1 }`
- **History:** Venezuela founded Petrocaribe on 29 June 2005, offering Caribbean states oil on preferential terms; in November 2005 the US-backed Free Trade Area of the Americas stalled at the Mar del Plata summit.
- **Theme:** energy, finance · **Notion:** update `3fceb012942f81eda8fdc6cdba372363`

### e2-sae-010 · Peace Mission 2005 · SAE · Ops 3 · Tempo

- **Event:** Russian and Chinese troops exercise together for the first time.
- **Design:** SAE 2 and +1 Ops this turn; the entente becomes military (W1 tag).
- **Playable:** `marker "joint exercise"; spend sae 2; mod sae +1 (turn)`
- **History:** In August 2005 Russia and China held Peace Mission 2005, their first joint military exercise, with around 10,000 troops in Russia's Far East and on China's Shandong peninsula.
- **Theme:** alliances · **Notion:** create

### e2-sae-011 · Munich Speech 2007 · SAE · Ops 1 · Opener

- **Event:** Russia's president tells the West the unipolar moment is over.
- **Design:** SAE +1 Ops this turn.
- **Playable:** `marker "unipolar moment over"; mod sae +1 (turn)`
- **History:** At the Munich Security Conference on 10 February 2007 President Putin attacked a "unipolar" world order and US dominance, in a speech widely seen as a turning point in Russia-West relations.
- **Theme:** information, alliances · **Notion:** create

### e2-sae-012 · Abu Ghraib · SAE · Ops 2 · Swing

- **Event:** Photographs from an Iraqi prison undercut the liberator's story.
- **Design:** SAE 1 and LIO -1 Ops this turn; deepens the Iraq credibility tag (W3).
- **Playable:** `marker "credibility hit"; spend sae 1; mod lio -1 min 1 (turn)`
- **History:** Photographs of US soldiers abusing detainees at Iraq's Abu Ghraib prison were broadcast on 28 April 2004, damaging the standing of the United States.
- **Theme:** information warfare · **Notion:** create

### e2-sae-013 · Chinese Anti-Satellite Test · SAE · Ops 2 · Gamble

- **Event:** A missile destroys a weather satellite and litters orbit with debris.
- **Design:** The demonstration impresses (SAE 2) or the debris angers everyone (SAE 1, LIO 1).
- **Playable:** `marker "debris field"; draw sae -> d; if d >= 3 { spend sae 2 } else { spend sae 1; spend lio 1 }`
- **History:** On 11 January 2007 China destroyed one of its own defunct weather satellites with a ground-launched missile, creating more than 3,000 pieces of trackable debris; it acknowledged the test on 23 January.
- **Theme:** space · **Notion:** create

## Neutral (8)

### e2-neu-001 · China Joins the WTO · neutral · Ops 3 · Split (LIO)

- **Event:** The world's factory enters the trade club.
- **Design:** Both prosper, SAE more (LIO 1, SAE 2); LIO may grant permanent normal trade (LIO 1 and SAE 1 more).
- **Playable:** `marker "open trade"; spend lio 1; spend sae 2; ask lio "Grant permanent normal trade?" -> v; if yes v { spend lio 1; spend sae 1 }`
- **History:** China became the 143rd member of the World Trade Organization on 11 December 2001.
- **Theme:** supply chains, finance · **Notion:** update `3fceb012942f8194ae10d6d2f767788b`

### e2-neu-002 · September 11 · neutral · Ops 1 · Opener

- **Event:** Hijacked airliners strike New York and Washington.
- **Design:** Shock to both: each side 1. The era's opening card if the owner wants one (see Owner questions).
- **Playable:** `marker "shock"; spend lio 1; spend sae 1`
- **History:** On 11 September 2001 hijacked airliners were crashed into the World Trade Center in New York and the Pentagon, killing thousands of people.
- **Theme:** proxy wars, alliances · **Notion:** update `3fceb012942f81c2b5d4c49a01a7aea5`

### e2-neu-003 · SARS · neutral · Ops 1 · Split (both)

- **Event:** A new virus spreads from Guangdong while officials stay quiet.
- **Design:** Each side: report openly (that side 1) or hide it (+1 Ops now, the rival 1 at turn end when it leaks).
- **Rules note:** if both hide it, each turn-end spend counts 2, because the spender's own +1 is still in force; the rules text says so (owner: keep it at 2, question 35).
- **Playable:** `marker "outbreak"; ask both "Report cases openly?" -> v; if yes v[lio] { spend lio 1 } else { mod lio +1 (turn); on turnEnd { spend sae 1 } }; if yes v[sae] { spend sae 1 } else { mod sae +1 (turn); on turnEnd { spend lio 1 } }`
- **History:** SARS emerged in Guangdong, China, in November 2002; by the time the WHO declared it contained on 5 July 2003, 8,098 cases and 774 deaths had been recorded.
- **Theme:** pandemics · **Notion:** create

### e2-neu-004 · IPCC Report and Nobel 2007 · neutral · Ops 1 · Hold

- **Event:** The scientific verdict on warming becomes unarguable.
- **Design:** Both sides 1 at turn end (the agenda arrives later than the report).
- **Playable:** `marker "climate consensus"; on turnEnd { spend lio 1; spend sae 1 }`
- **History:** The IPCC's Fourth Assessment Report in 2007 called warming unequivocal and very likely human-caused; the panel shared the 2007 Nobel Peace Prize, announced on 12 October 2007.
- **Theme:** climate · **Notion:** create

### e2-neu-005 · Oil at $147 · neutral · Ops 2 · Split (SAE)

- **Event:** Crude breaks $100, then $147, then collapses.
- **Design:** SAE (the producers) chooses: pump more (SAE 1, LIO 1) or ride the spike (SAE 2 but -1 Ops as the economy overheats).
- **Playable:** `marker "oil spike"; ask sae "Open the taps?" -> v; if yes v { spend sae 1; spend lio 1 } else { spend sae 2; mod sae -1 min 1 (turn) }`
- **History:** Crude oil first traded above $100 a barrel on 2 January 2008 and peaked near $147 on 11 July 2008 before collapsing with the financial crisis.
- **Theme:** energy · **Notion:** create

### e2-neu-006 · Natanz Revealed · neutral · Ops 2 · Hold

- **Event:** A secret Iranian enrichment site is exposed.
- **Design:** SAE 1 now (a new client); LIO 1 at turn end (inspections and sanctions begin). Sets the Iran tag Stuxnet and the Iran deal build on (W3).
- **Playable:** `marker "programme revealed"; spend sae 1; on turnEnd { spend lio 1 }`
- **History:** An Iranian opposition group publicised a secret uranium-enrichment site at Natanz in August 2002; Iran acknowledged the facility to the IAEA in February 2003.
- **Theme:** arms, proxy · **Notion:** create

### e2-neu-007 · Kosovo Declares Independence · neutral · Ops 2 · Plain

- **Event:** A precedent both sides will quote back at each other.
- **Design:** Each side 1; the "precedent" tag is cited by Crimea (W3).
- **Playable:** `marker "precedent set"; spend lio 1; spend sae 1`
- **History:** Kosovo declared independence from Serbia on 17 February 2008. The United States and most EU states recognised it; Serbia and Russia did not.
- **Theme:** alliances, gray-zone · **Notion:** create

### e2-neu-008 · Sovereign Wealth Funds · neutral · Ops 2 · Split (LIO)

- **Event:** Gulf and Chinese state funds buy into wobbling Western banks.
- **Design:** LIO may take the money (LIO 2 now, SAE 1 at turn end as leverage) or refuse it (LIO 1).
- **Playable:** `marker "petro-dollars"; ask lio "Let them buy in?" -> v; if yes v { spend lio 2; on turnEnd { spend sae 1 } } else { spend lio 1 }`
- **History:** As the credit crisis spread in late 2007, state funds bought stakes in Western banks, including Abu Dhabi's $7.5 billion investment in Citigroup in November 2007 and China Investment Corporation's purchase of a Morgan Stanley stake in December 2007.
- **Theme:** sanctions and finance · **Notion:** create

## Stage 3 build notes

All 29 cards are built as `packages/content/cards/era-2/<id>.json`, each with a test that plays it in the real engine
and checks every branch. The JSON follows the "Playable" line of each card one-for-one; no card was built weaker than
planned. The rules text of each file is written from the JSON.

- **Neutral cards (all 8): the event is built but stays dormant in a real game**, as in Era 1 (Owner question 26).
  Their tests run the event as if the card were LIO's.
- **Entering the game:** the TEST scenario `first-deck-test` lists all 34 Era 2 cards in its `eras` at turn 3. They
  are shuffled into the draw pile then, but hands never refill, so the AI game does not play them yet (question 34).
- **SARS (e2-neu-003):** turn-end spends happen while the spender's own Ops swing is still in force, so if both hide it each pays 2; kept, and the rules text says so (question 35).
- **Ruleset:** the first-deck ruleset now holds 68 cards (Era 1 and Era 2); it lives in `firstDeckRules.ts`.
