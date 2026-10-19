# Era 3 cards: 2008 to 2025 (the crash to today)

Part of the [deck plan](deck-plan.md). Notation, rules-text templates and the wish-list codes (W1-W8) are
defined there. Every card: LIO 8, SAE 12, neutral 8 (the plan had 13, 13 and 8; the owner removed the rest as not well known or significant enough, and their numbers stay unused; the owner then added October 7 and Gaza, Owner question 14), plus six optional roles-only "future" cards at the
end. Era string in JSON: `"era-3"` (future cards: `"future"`). Events from 2025 on name roles, not people.

## LIO (8)

### e3-lio-001 · Stuxnet · LIO · Ops 2 · Gamble

- **Event:** A worm wrecks Iranian centrifuges; nobody admits writing it.
- **Design:** The sabotage works (LIO 2) or the weapon escapes and everyone learns from it (SAE 1, a "cyberweapon loose" tag W3).
- **Playable:** `draw lio -> d; if d >= 3 { marker "centrifuges spin apart"; spend lio 2 } else { marker "cyberweapon loose"; spend sae 1 }`
- **History:** The Stuxnet worm, discovered in June 2010, damaged uranium-enrichment centrifuges at Iran's Natanz plant; no government has officially acknowledged creating it.
- **Theme:** cyber · **Notion:** update `3fceb012942f8102880ce90256a71ff3`

### e3-lio-002 · Neptune Spear · LIO · Ops 1 · Gamble

- **Event:** Helicopters cross into Pakistan at night on a 50-50 call.
- **Design:** A real gamble: the raid succeeds (LIO 2) or fails in public (SAE 1).
- **Playable:** `draw lio -> d; if d >= 2 { marker "raid succeeds"; spend lio 2 } else { marker "raid fails"; spend sae 1 }`
- **History:** On 2 May 2011 US special forces raided a compound in Abbottabad, Pakistan and killed Osama bin Laden, the leader of al-Qaeda.
- **Theme:** proxy wars, intelligence · **Notion:** update `3fceb012942f81cda0dcd8e4014b8076`

### e3-lio-003 · Ghost Stories · LIO · Ops 2 · Split (LIO)

- **Event:** Ten Russian sleeper agents are arrested in American suburbs.
- **Design:** LIO 2; LIO may trade them for its own people on a Vienna runway (each side 1 at turn end) or jail them.
- **Playable:** `marker "sleepers exposed"; spend lio 2; ask lio "Trade them?" -> v; if yes v { on turnEnd { spend lio 1; spend sae 1 } } else { marker "no exchange" }`
- **History:** On 27 June 2010 the FBI arrested ten Russian agents who had lived under false identities in the United States; on 9 July 2010 they were exchanged in Vienna for four people held in Russia.
- **Theme:** gray-zone, intelligence · **Notion:** update `3fceb012942f81a58fe9f2ed14425fa7`

### e3-lio-006 · Chip Chokepoint · LIO · Ops 3 · Split/Gamble (LIO)

- **Event:** Export rules cut China off from the most advanced chips and the machines that make them.
- **Design:** LIO may bring the allies in: a gamble between a sealed chokepoint (LIO 3) and leaky controls (LIO 1); or go alone for a sure 2.
- **Playable:** `ask lio "Bring the allies in?" -> v; if yes v { draw lio -> d; if d >= 3 { marker "chokepoint sealed"; spend lio 3 } else { marker "controls leak"; spend lio 1 } } else { spend lio 2 }`
- **History:** The United States added Huawei to its export-control Entity List on 16 May 2019 and on 7 October 2022 imposed sweeping controls on advanced chips and chip-making tools bound for China, tightened again in October 2023.
- **Theme:** AI and technology, supply chains · **Notion:** update `3fceb012942f8124ba44eea677565da7` (5G/Huawei row folded in)

### e3-lio-009 · Nordic Accession · LIO · Ops 2 · Plain

- **Event:** Finland and Sweden end two centuries of non-alignment.
- **Design:** LIO 2; an "enlargement" tag extended (W1).
- **Playable:** `marker "Baltic lake"; spend lio 2`
- **History:** Finland and Sweden applied to join NATO in May 2022; Finland joined on 4 April 2023 and Sweden on 7 March 2024.
- **Theme:** alliances · **Notion:** update `3fceb012942f819d8ccbf17370554616`

### e3-lio-010 · AUKUS · LIO · Ops 1 · Hold

- **Event:** Australia, the UK and the US agree on nuclear submarines that arrive decades later.
- **Design:** LIO 1 now and 1 at turn end: a pact that pays slowly (W1).
- **Playable:** `marker "pact"; spend lio 1; on turnEnd { spend lio 1 }`
- **History:** Australia, the United Kingdom and the United States announced the AUKUS security partnership on 15 September 2021, including a plan for Australian nuclear-powered submarines; Australia cancelled a French submarine contract the same day.
- **Theme:** alliances · **Notion:** update `3fceb012942f81939790c9643c53ad35`

### e3-lio-011 · Private Constellation · LIO · Ops 2 · Hold

- **Event:** A private company's satellites keep a country online in wartime.
- **Design:** LIO 1 now and 1 at turn end; a "private space" tag (W3). The dependence on one company is the design-layer sting (owner question on company names).
- **Playable:** `marker "constellation"; spend lio 1; on turnEnd { spend lio 1 }`
- **History:** SpaceX launched the first 60 Starlink satellites on 23 May 2019; within days of Russia's February 2022 invasion the service was activated in Ukraine and became an important part of its communications.
- **Theme:** space, technology · **Notion:** update `3fceb012942f8141aae4f4a79d9efbf8`

### e3-lio-013 · Fall of the Assad Regime · LIO · Ops 2 · Swing

- **Event:** Damascus falls in eleven days and Russia's Mediterranean bases hang by a thread.
- **Design:** LIO 2 and SAE -1 Ops this turn: a client lost.
- **Playable:** `marker "foothold lost"; spend lio 2; mod sae -1 min 1 (turn)`
- **History:** Syrian rebel forces took Damascus on 8 December 2024 and President Bashar al-Assad fled to Russia, ending more than fifty years of his family's rule; the future of Russia's air and naval bases in Syria became uncertain.
- **Theme:** proxy wars · **Notion:** update `3fceb012942f81af9c28e803d68d0ffa`

## SAE (12)

### e3-sae-001 · Global Financial Crisis · SAE · Ops 2 · Swing (both)

- **Event:** Lehman fails and the Western model loses its shine.
- **Design:** Both sides -1 Ops this turn and SAE 1: the crisis is everyone's, the credibility loss is LIO's. Era 3's natural opening card (see Owner questions).
- **Playable:** `marker "credit crunch"; mod both -1 min 1 (turn); spend sae 1`
- **History:** Lehman Brothers filed for bankruptcy on 15 September 2008, the largest in US history, and the first G20 leaders' summit met in Washington in November 2008 to coordinate the response.
- **Theme:** finance · **Notion:** update `3fceb012942f81828b7bf865e8620d00`

### e3-sae-002 · Belt and Road · SAE · Ops 3 · Split (LIO)

- **Event:** China lends the world its roads, ports and railways.
- **Design:** SAE 3; LIO may challenge the loan terms: LIO 1 at turn end, but -1 Ops this turn spent on the campaign.
- **Playable:** `marker "corridors"; spend sae 3; ask lio "Challenge the loan terms?" -> v; if yes v { mod lio -1 min 1 (turn); on turnEnd { spend lio 1 } } else { marker "unanswered" }`
- **History:** China's leader announced the "Silk Road Economic Belt" in Astana on 7 September 2013 and a maritime counterpart in Jakarta that October; in December 2017 Sri Lanka handed the Chinese-financed port of Hambantota to a Chinese company on a 99-year lease.
- **Theme:** supply chains, finance · **Notion:** update `3fceb012942f81478758f96150bc0d64` (Sri Lanka/Zambia row folded in)

### e3-sae-003 · Annexation of Crimea · SAE · Ops 3 · Hold

- **Event:** Unmarked soldiers, a two-week referendum and a redrawn border.
- **Design:** SAE 3; LIO 1 at turn end as sanctions begin. Would cash in the "hollow assurance" and "precedent" tags (W3).
- **Playable:** `marker "borders redrawn"; spend sae 3; on turnEnd { spend lio 1 }`
- **History:** Russian forces took control of Crimea in late February 2014; after a referendum on 16 March 2014 Russia annexed the peninsula on 18 March, and the UN General Assembly declared the referendum invalid on 27 March 2014.
- **Theme:** gray-zone, proxy wars · **Notion:** update `3fceb012942f8126818be1c71b7818e1`

### e3-sae-004 · Full-Scale Invasion · SAE · Ops 4 · Hot

- **Event:** The largest war in Europe since 1945 begins.
- **Design:** SAE 3 and LIO -1 Ops this turn; LIO 1 at turn end as the West rallies. Hot: 4 Ops for LIO holders who can stomach the event.
- **Playable:** `marker "full-scale war"; spend sae 3; mod lio -1 min 1 (turn); on turnEnd { spend lio 1 }`
- **History:** Russia launched a full-scale invasion of Ukraine on 24 February 2022, twenty days after Russia and China declared a partnership with "no limits" in Beijing on 4 February 2022.
- **Theme:** proxy wars, alliances · **Notion:** update `3fceb012942f8135ba48ebf191eafbef`

### e3-sae-005 · The Leaks · SAE · Ops 1 · Tempo

- **Event:** Diplomatic cables, then surveillance programmes, spill onto the internet.
- **Design:** SAE 1 after every card played this turn, by either side (W2): each new story lands on the last.
- **Playable:** `marker "surveillance exposed"; on cardPlayed (turn) { spend sae 1 }`
- **History:** WikiLeaks began publishing some 250,000 US diplomatic cables on 28 November 2010; in June 2013 documents leaked by Edward Snowden revealed large-scale US surveillance programmes.
- **Theme:** information warfare · **Notion:** update `3fceb012942f81ad9174c281c38c34e4` (WikiLeaks row folded in)

### e3-sae-007 · Rare Earth Squeeze · SAE · Ops 2 · Split (LIO)

- **Event:** A fishing-boat collision and the magnets stop shipping.
- **Design:** LIO gives way (SAE 2) or holds firm and goes short (LIO -1 Ops this turn, but SAE only 1).
- **Playable:** `marker "supply squeezed"; ask lio "Give way?" -> v; if yes v { spend sae 2 } else { mod lio -1 min 1 (turn); spend sae 1 }`
- **History:** After a Chinese trawler collided with Japanese coastguard vessels near disputed islands on 7 September 2010, Japanese importers reported a halt in Chinese rare-earth shipments that lasted into late September; China denied an embargo, and later analysts have disputed how complete the halt was.
- **Theme:** supply chains · **Notion:** update `3fceb012942f81f8ad01f236094047b5`

### e3-sae-008 · Syrian Intervention · SAE · Ops 3 · Hold

- **Event:** Russian jets save a client and Russia returns to the Middle East.
- **Design:** SAE 2 now and 1 at turn end; a "foothold" tag that Assad's fall removes (W1, W3).
- **Playable:** `marker "proxy war"; spend sae 2; on turnEnd { spend sae 1 }`
- **History:** Russia began air strikes in Syria on 30 September 2015 in support of the Assad government, its first major military operation outside the former Soviet Union since the Cold War.
- **Theme:** proxy wars · **Notion:** update `3fceb012942f8115abd1c8c2714da8f8`

### e3-sae-009 · Parallel Plumbing · SAE · Ops 2 · Split (LIO)

- **Event:** The BRICS build their own bank and payment rails.
- **Design:** SAE 2; LIO may join the bank (LIO 1 and SAE 1 more: legitimacy for both) or stay out.
- **Playable:** `marker "parallel plumbing"; spend sae 2; ask lio "Join the bank?" -> v; if yes v { spend lio 1; spend sae 1 } else { marker "stayed out" }`
- **History:** Brazil, Russia, India and China held their first BRIC summit in Yekaterinburg on 16 June 2009; the China-led Asian Infrastructure Investment Bank opened on 16 January 2016 with 57 founding members, and China has built its own cross-border payment system.
- **Theme:** finance · **Notion:** update `3fceb012942f817ca834c5f2284e39bb` (First BRIC Summit row folded in)

### e3-sae-010 · Fall of Kabul · SAE · Ops 1 · Opener

- **Event:** The Taliban retake the capital before the last Western plane leaves.
- **Design:** SAE 1 and LIO -1 Ops this turn: resolve questioned.
- **Playable:** `marker "resolve questioned"; spend sae 1; mod lio -1 min 1 (turn)`
- **History:** Taliban forces entered Kabul on 15 August 2021 as the Afghan government collapsed during the withdrawal of US and allied forces.
- **Theme:** proxy wars, alliances · **Notion:** update `3fceb012942f81c9981bdfaca18f95dd`

### e3-sae-011 · Hong Kong Security Law · SAE · Ops 2 · Split (LIO)

- **Event:** The 50-year promise ends after 23.
- **Design:** SAE 2; LIO may sanction (LIO 1 now, SAE 1 at turn end as it shrugs them off) or not.
- **Playable:** `marker "promise ended"; spend sae 2; ask lio "Impose sanctions?" -> v; if yes v { spend lio 1; on turnEnd { spend sae 1 } } else { marker "no sanctions" }`
- **History:** China's national security law for Hong Kong was passed and took effect on 30 June 2020, criminalising secession, subversion, terrorism and collusion with foreign forces.
- **Theme:** gray-zone · **Notion:** create

### e3-sae-012 · Hypersonics on Parade · SAE · Ops 1 · Gamble

- **Event:** New missiles roll through Tiananmen Square.
- **Design:** A three-way draw: the display awes (SAE 2), it is ordinary (SAE 1) or it spurs an answering build-up (LIO 1).
- **Playable:** `marker "new missiles"; draw sae -> d; if d >= 4 { spend sae 2 } else { if d <= 2 { spend lio 1 } else { spend sae 1 } }`
- **History:** China displayed the DF-17 hypersonic glide-vehicle missile for the first time at its 1 October 2019 National Day parade in Beijing.
- **Theme:** arms, technology · **Notion:** update `3fceb012942f81ce8319e9ae416bb1e0`

### e3-sae-013 · Eurozone Crisis · SAE · Ops 2 · Split (LIO)

- **Event:** Greece needs €110 billion and sells its biggest port to China.
- **Design:** LIO bails out (LIO 1 but -1 Ops this turn) or lets the strategic assets go (SAE 2).
- **Playable:** `marker "troika"; ask lio "Bail out Greece?" -> v; if yes v { spend lio 1; mod lio -1 min 1 (turn) } else { marker "port sold"; spend sae 2 }`
- **History:** Greece agreed its first €110 billion bailout from eurozone countries and the IMF on 3 May 2010; in 2016 China's COSCO bought a 67 per cent stake in the Piraeus Port Authority.
- **Theme:** finance, supply chains · **Notion:** update `3fceb012942f8127a8c5c220856f4724`

## Neutral (8)

These neutral cards were built before neutral cards could draw a Contingency card (allowed since #126; see Owner
question 1), so they use choices instead. Redesigns that use draws are a follow-up pull request.

### e3-neu-001 · Arab Spring · neutral · Ops 2 · Split (both)

- **Event:** A protest in a Tunisian town topples four governments.
- **Design:** Each side chooses whether to back the protesters: backing them scores 1 but costs 1 Ops this turn; standing by scores nothing. If exactly one side backs them, the other scores 1 at turn end as the old order regroups (nested ifs).
- **Playable:** `marker "the square"; ask both "Back the protesters?" -> v; if yes v[lio] { spend lio 1; mod lio -1 min 1 (turn); if yes v[sae] { spend sae 1; mod sae -1 min 1 (turn) } else { on turnEnd { spend sae 1 } } } else { if yes v[sae] { spend sae 1; mod sae -1 min 1 (turn); on turnEnd { spend lio 1 } } }`
- **History:** Protests that began in Sidi Bouzid, Tunisia in December 2010 spread across the Arab world; Tunisia's president fled on 14 January 2011, Egypt's resigned on 11 February 2011, and Libya's was killed in October 2011.
- **Theme:** populism, information · **Notion:** update `3fceb012942f816ca3d2cbd72a486695`

### e3-neu-002 · COVID-19 · neutral · Ops 3 · Split (both)

- **Event:** A virus closes the world.
- **Design:** Each side chooses: close the borders (that side 1 and -1 Ops this turn) or keep them open (that side 2 but the rival 1 as the outbreak spreads). Big Ops because the whole world stopped.
- **Playable:** `marker "pandemic"; ask both "Close the borders?" -> v; if yes v[lio] { spend lio 1; mod lio -1 min 1 (turn) } else { spend lio 2; spend sae 1 }; if yes v[sae] { spend sae 1; mod sae -1 min 1 (turn) } else { spend sae 2; spend lio 1 }`
- **History:** The World Health Organization declared COVID-19 a pandemic on 11 March 2020, when about 118,000 cases had been reported in 114 countries; millions of deaths followed worldwide.
- **Theme:** pandemics · **Notion:** update `3fceb012942f8110aa71d0baf95b9275`

### e3-neu-003 · Paris Agreement · neutral · Ops 1 · Split (LIO)

- **Event:** Every country pledges to limit warming; the biggest economy leaves, returns and leaves again.
- **Design:** LIO decides: stay in (LIO 1 but -1 Ops this turn) or walk out (SAE 1 as the leadership passes).
- **Playable:** `marker "pledges"; ask lio "Stay in the agreement?" -> v; if yes v { spend lio 1; mod lio -1 min 1 (turn) } else { spend sae 1 }`
- **History:** The Paris Agreement on climate change was adopted on 12 December 2015 and entered into force in November 2016; the United States announced its withdrawal in June 2017, rejoined in February 2021 and announced a second withdrawal in 2025.
- **Theme:** climate · **Notion:** create

### e3-neu-004 · Migration Crises · neutral · Ops 1 · Hold

- **Event:** A million people cross the Mediterranean in one year, and millions more leave Venezuela.
- **Design:** LIO -1 Ops this turn under the strain; LIO 1 at turn end as the arrivals are absorbed. Would read a "proxy war" tag (W3).
- **Playable:** `marker "a million arrivals"; mod lio -1 min 1 (turn); on turnEnd { spend lio 1 }`
- **History:** In 2015 just over one million refugees and migrants reached Europe by sea, more than 800,000 of them via Greece, and about half of them from Syria; at least 3,700 died or went missing at sea. By 2024 more than 7 million people had left Venezuela since its economic collapse began in 2014, most of them for other Latin American countries.
- **Theme:** migration · **Notion:** update `3fceb012942f815a99d4d82893c377f3` (side changed from SAE to neutral; renamed from "Migration Crisis 2015" and Venezuela added by the owner, Owner question 21)

### e3-neu-005 · Populist Wave · neutral · Ops 2 · Split (SAE)

- **Event:** From the Brexit vote and Italy's populist coalition to the storming of the Capitol and of Brasília's seat of power, voters upend the establishment.
- **Design:** SAE may amplify the turmoil online (SAE 1 and LIO -1 Ops this turn) or stand back (LIO 1 as institutions hold). The card judges no voter; see Owner questions.
- **Playable:** `marker "ballot shock"; ask sae "Amplify it online?" -> v; if yes v { spend sae 1; mod lio -1 min 1 (turn) } else { spend lio 1 }`
- **History:** The United Kingdom voted to leave the European Union on 23 June 2016 by 51.9 per cent to 48.1, and on 1 June 2018 a coalition of the Five Star Movement and the League took office in Italy. On 6 January 2021 a crowd stormed the US Capitol during the certification of the presidential election; on 8 January 2023 supporters of Brazil's defeated former president stormed the country's Congress, Supreme Court and presidential palace.
- **Theme:** populism and elections · **Notion:** update `3fceb012942f81b79b47c9c908c0c373` (was "Brexit", SAE; Jan 6 and 2000 election rows folded in; Italy 2018 and Brasília 2023 added by the owner, Owner question 15)

### e3-neu-007 · AI Compute Race · neutral · Ops 2 · Split (LIO)

- **Event:** A chatbot reaches 100 million users; a cheap rival model wipes $600 billion off the leader.
- **Design:** LIO leads (LIO 1); it may tighten the compute controls (LIO 1 more, but SAE 1 as the rival learns to do more with less) or let the market run (SAE 1).
- **Playable:** `marker "compute race"; spend lio 1; ask lio "Tighten compute controls?" -> v; if yes v { spend lio 1; spend sae 1 } else { spend sae 1 }`
- **History:** ChatGPT launched on 30 November 2022 and was estimated to have reached 100 million monthly users by January 2023; on 27 January 2025, after the Chinese company DeepSeek released a low-cost model, Nvidia's shares fell about 17 per cent, losing nearly $600 billion in value.
- **Theme:** AI and technology · **Notion:** update `3fceb012942f819ea8cbc7011590fa3d`

### e3-neu-008 · Tariff Shock · neutral · Ops 2 · Split (SAE)

- **Event:** The U.S. President declares "Liberation Day" and taxes imports from everywhere.
- **Design:** LIO -1 Ops this turn; SAE may retaliate (SAE 1 but -1 Ops too) or hold fire and court the rest of the world (SAE 1 at turn end). Roles only: names no person.
- **Playable:** `marker "tariff wall"; mod lio -1 min 1 (turn); ask sae "Retaliate?" -> v; if yes v { spend sae 1; mod sae -1 min 1 (turn) } else { on turnEnd { spend sae 1 } }`
- **History:** On 2 April 2025 the U.S. President announced a 10 per cent tariff on imports from almost all countries, effective 5 April, with higher rates for many trading partners announced for 9 April; the rates changed repeatedly in the following months.
- **Theme:** supply chains, finance · **Notion:** update `3fceb012942f816887d1e8e9b0bc1aee` (TPP and "Return of Trump" rows folded in)

### e3-neu-009 · October 7 and Gaza · neutral · Ops 2 · Split (both)

- **Event:** Hamas-led attacks on Israel are followed by a war in Gaza.
- **Design:** Each side chooses whether to press for a ceasefire: pressing scores 1 but costs 1 Ops this turn; holding back gives the rival 1. Approved by the owner (Owner question 14), who chose this over a version with no choice.
- **Playable:** `marker "the region on edge"; ask both "Press for a ceasefire?" -> v; if yes v[lio] { spend lio 1; mod lio -1 min 1 (turn) } else { spend sae 1 }; if yes v[sae] { spend sae 1; mod sae -1 min 1 (turn) } else { spend lio 1 }`
- **History:** On 7 October 2023 Hamas-led attacks on Israel killed about 1,200 people and took 251 hostages. The war in Gaza that followed killed tens of thousands of people, according to Gaza's health ministry, and displaced most of its 2.1 million people.
- **Theme:** alliances · **Notion:** `3feeb012942f817ca0a0e37c453e86e2`

## Optional future cards: 2025 to 2027 (6)

Only if the owner wants the optional scenario in eras.md. Era string `"future"`; roles only; history notes
describe the trend, not a dated event. Ops: 2, 1 per side; neutral 2, 1.

### ef-lio-001 · Allied Drone Wall · LIO · Ops 2 · Hold

- **Design/Playable:** `marker "sensors along the frontier"; spend lio 1; on turnEnd { spend lio 1 }`
- **History:** From 2024 NATO's eastern members announced joint plans for drone and sensor defences along the alliance's eastern frontier.

### ef-lio-002 · Undersea Cable Patrols · LIO · Ops 1 · Opener

- **Design/Playable:** `marker "cables watched"; mod sae -1 min 1 (turn)`
- **History:** After a series of damaged cables in the Baltic Sea in late 2024, NATO states increased naval patrols of undersea infrastructure.

### ef-sae-001 · Shadow Fleet · SAE · Ops 2 · Gamble

- **Design/Playable:** `draw sae -> d; if d >= 3 { marker "sanctions evaded"; spend sae 2 } else { marker "tanker seized"; spend lio 1 }`
- **History:** From 2022 a growing fleet of ageing, obscurely owned tankers carried Russian oil outside Western insurance and price-cap rules.

### ef-sae-002 · Cable Cut in the Baltic · SAE · Ops 1 · Opener

- **Design/Playable:** `marker "anchor dragged"; mod lio -1 min 1 (turn)`
- **History:** On 25 December 2024 the Estlink 2 power cable and several data cables between Finland and Estonia were damaged; Finland boarded a tanker suspected of dragging its anchor across them.

### ef-neu-001 · Open-Weight Model Leak · neutral · Ops 2 · Swing (both)

- **Design/Playable:** `marker "weights everywhere"; mod both +1 (turn)`
- **History:** From 2023 several leading AI developers released model weights openly, and leaked or open models spread capability far beyond their makers.

### ef-neu-002 · Heat Dome Summer · neutral · Ops 1 · Swing (both)

- **Design/Playable:** `marker "record heat"; mod both -1 min 1 (turn)`
- **History:** The years 2023 and 2024 were the warmest in the instrumental record, with prolonged heat waves across several continents.

## Stage 4 build notes

All 28 Era 3 cards are built as `packages/content/cards/era-3/<id>.json` and the 6 future cards as
`packages/content/cards/future/<id>.json`, each with a test that plays it in the real engine and checks every branch.
The JSON follows the "Playable" line of each card one-for-one; no card was built weaker than planned. The rules text
of each file is written from the JSON.

- **Neutral cards (all 7) stay dormant in a real game**, as in Eras 1 and 2 (Owner question 26). Their tests run the
  event as if the card were LIO's. The two future neutral cards behave the same.
  **Since lifted (Owner question 26):** the engine now runs neutral events and lets a neutral card open, and the
  tests play each neutral card as the neutral card it is.
- **Entering the game:** the TEST scenario `first-deck-test` lists the 34 Era 3 cards in its `eras` at turn 5 (the
  plan's placeholder) and the 6 future cards at turn 6 (the last turn; the plan gave no turn, Owner question 38). They
  are shuffled into the draw pile then, and the turn-start refill draws them into hands (question 27).
- **Future cards:** era string `future`, folder `cards/future/`, ids `ef-...` (the plan's choice). Roles only; their
  history notes describe a trend or a dated event, not a named person. Wired in `futureFiles.ts`.
- **Ruleset:** the first-deck ruleset now holds 108 cards (Eras 1 to 3 and the future cards).
- **Ops 4 cards** (Sanctions Wall, Full-Scale Invasion) have no once-only rule yet (wish W6), as in earlier eras.
- **Turn-end spends under a "count more" bonus:** Arab Spring and the two neutral Ops swings follow question 35: a
  turn-end spend may happen while a "+1" for that side is still in force. Only Arab Spring has both a turn-end spend
  and a side modifier on different sides, so no spend of 1 is raised to 2 by this card's own modifiers.
