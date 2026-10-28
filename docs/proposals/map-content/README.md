Proposal, not a rule

# The six-region map's content, and the order regions close at Escalation

**Decided 28 Oct (owner, chosen in chat): option 2, H1, Crimea as its own box, closing order C1, and the order regions score in, S1 (the closing order's own list). Questions 5 to 10 below are not answered yet; see `docs/design/map-and-points.md`, "Map" and "Owner's remaining questions".** The text below is the original proposal, which recommends nothing.

Sprint backlog X6. This proposal lays out options for owner question 3 in `docs/design/map-and-points.md`:
the countries in each region, their adjacency, stabilities and battlegrounds, and which regions close at
Escalation 3, 4 and 5, in what order. It decides nothing and recommends nothing. Until the owner decides, the
map stays "open (scenario data)" and the rules lane works on its test map.

To stay under about 350 lines a file, it is split:

| File                       | What it holds                                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This README                | What is settled, how the tables are written, the home-box and Crimea questions, the closing orders, the cards that name a place, how the tables were checked, and the questions for the owner |
| [option-1.md](option-1.md) | Option 1: even regions, six countries each (36 countries, 12 battlegrounds)                                                                                                                   |
| [option-2.md](option-2.md) | Option 2: card places first, uneven regions (41 countries, 17 battlegrounds)                                                                                                                  |
| [option-3.md](option-3.md) | Option 3: compact, five countries per region (30 countries, 12 battlegrounds)                                                                                                                 |

## Settled, and not reopened here

Every option keeps what `map-and-points.md` ("Map") already decides:

- **Six regions**, and **one map for the whole game, 1991 to 2025**; it does not change between eras.
- **The United States is the LIO home box.**
- **Russia and China are both part of the SAE home box**, and **Hong Kong is part of China**. Home boxes are not
  countries for placing or control; countries next to a home box count as next to that side's influence.
- **Taiwan starts LIO-aligned.**
- **Crimea starts as the history of 1991 says.**

Every option also uses the six regions of W7 map option A, which the owner chose: Europe; Eastern Europe and
Central Asia; the Middle East and North Africa; Sub-Saharan Africa; East and South Asia (with Oceania); the
Americas. And every option fits Decision 4 (the map's topology is rules data in a scenario, the artwork is
separate and keyed by country ID) and Decision 6 (the map is drawn for an 844 x 390 phone screen first).

## How the tables are written

- One row per country: region, country (real places only), stability, battleground flag (BG), neighbours.
- **Stability** is a whole number from 1 up. Every stability and battleground flag is a placeholder that makes
  the trade-offs concrete; none is a proposed value for play.
- **Neighbours** are land borders and short sea crossings, plus two kinds of link each option file lists below
  its table: links that cross land holding no country on the board (Poland-Estonia across Lithuania and Latvia,
  for example), and a few long links across a sea or ocean (United Kingdom-Canada, for example).
- "LIO box" and "SAE box" in a neighbour list mean the country touches that home box.
- **Starting influence** is out of scope except for Taiwan and Crimea, and for both the design file gives a
  side or a history, not a number; each option file says so where Taiwan and Crimea sit.

## The open home-box question

`map-and-points.md` leaves open whether Russia's and China's borders are only artwork or also decide which
countries touch the SAE box. This proposal does not answer it. The options:

- **H1, borders decide.** Every country on the board that borders Russia or China by land or a short sea
  crossing touches the SAE box (for example Poland, through Kaliningrad, and Japan, across the strait north of
  Hokkaido), and so does a country cut off from them only by land with no country on the board (South Korea in
  option 1, across North Korea). The option tables list home-box neighbours under H1.
- **H2, borders are artwork only.** The scenario lists the countries that touch the SAE box, whatever the art
  shows. To make the comparison concrete, each option file uses an example list of three countries, as many as
  the LIO box touches, and lists only the rows H2 changes. Which countries, and how many, would be the owner's
  choice.

Under either option the LIO box touches Canada, Mexico and Cuba (Cuba across the Florida Straits).

## The Crimea question

Whether Crimea is its own box or part of Ukraine is a question for the owner, not answered here (W7 map
question 4; it is a political choice as well as a rules one). Each option file shows Crimea inside Ukraine's
row and gives the extra row Crimea would have as its own box. Either way it starts as the history of 1991 says.

## Closing orders at Escalation 3, 4 and 5

One region closes to interventions and realignments at each threshold, and a closed region stays closed as the
track rises (`map-and-points.md`, "Thresholds close regions"). Placing is never blocked. The options:

| Order | Closes at 3                     | Closes at 4                     | Closes at 5                  | Open at Brink                                                  | Idea                                                        |
| ----- | ------------------------------- | ------------------------------- | ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| C1    | Eastern Europe and Central Asia | East and South Asia             | Europe                       | Middle East and North Africa, Sub-Saharan Africa, the Americas | The frontiers where the great powers meet close first       |
| C2    | Sub-Saharan Africa              | The Americas                    | Middle East and North Africa | Europe, Eastern Europe and Central Asia, East and South Asia   | The regions farthest from the SAE box close first           |
| C3    | East and South Asia             | Eastern Europe and Central Asia | Middle East and North Africa | Europe, Sub-Saharan Africa, the Americas                       | The regions of the period's nuclear flashpoints close first |

- **C1 is the dialogue's suggestion, not a decision** ("the frontiers where the great powers meet close
  first"). Read here as: Russia's western and southern edge, then China's eastern and southern edge, then
  Europe. As Escalation rises the contest moves to regions far from both great powers.
- **C2** is C1's opposite: the contest at the brink stays in the regions next to the SAE box.
- **C3** closes first where the period's nuclear standoffs sit (India and Pakistan, the Korean peninsula, the
  Taiwan Strait; then Ukraine; then the Middle East, with Iran's enrichment sites).

Each option file shows what each order closes on its board: the battlegrounds left open to interventions (and
so to raising Escalation further) at each threshold, and which side's home-box neighbours are frozen.

## Cards that name a place

The cards below have a place at the centre of their story outside the two home boxes, taken from the title,
Event line or History line in `docs/design/cards/era-1.md`, `era-2.md` and `era-3.md`. A treaty named after its
host city is listed under the country it concerns when the Event line names one (Budapest Memorandum: Ukraine),
otherwise under its host country (Maastricht Treaty: Netherlands; Munich Speech 2007: Germany; Kyoto Protocol:
Japan); Oslo Accords is listed under Israel. "All", "some" or "none" says how many of the card's places are on
each option's board; Crimea counts as on the board either way. No card changes as part of this proposal.

| Card                           | Era    | Places                                                            | Opt. 1      | Opt. 2     | Opt. 3      |
| ------------------------------ | ------ | ----------------------------------------------------------------- | ----------- | ---------- | ----------- |
| Maastricht Treaty              | 1      | Netherlands                                                       | none        | none       | none        |
| Budapest Memorandum            | 1      | Ukraine                                                           | all         | all        | all         |
| NATO Enlargement 1999          | 1      | Poland, Hungary, Czech Republic                                   | some        | some       | some        |
| Desert Storm Coalition         | 1      | Kuwait, Iraq                                                      | some        | some       | some        |
| Oslo Accords                   | 1      | Israel                                                            | all         | all        | all         |
| Battle of Mogadishu            | 1      | Somalia                                                           | all         | all        | none        |
| Shanghai Five                  | 1      | Kazakhstan, Kyrgyzstan, Tajikistan                                | some        | all        | some        |
| Taiwan Strait Crisis           | 1      | Taiwan                                                            | all         | all        | all         |
| Primakov's U-turn              | 1      | Serbia                                                            | all         | all        | all         |
| Belgrade Embassy Bombing       | 1      | Serbia                                                            | all         | all        | all         |
| Pristina Airport Dash          | 1      | Kosovo                                                            | none        | none       | none        |
| Rwandan Genocide               | 1      | Rwanda                                                            | all         | all        | all         |
| Asian Financial Crisis         | 1      | Thailand                                                          | none        | none       | none        |
| Al Jazeera Launches            | 1      | Qatar                                                             | none        | none       | none        |
| Kyoto Protocol                 | 1      | Japan                                                             | all         | all        | all         |
| Libya Disarms                  | 2      | Libya                                                             | none        | all        | none        |
| Big Bang Enlargement 2004      | 2      | Estonia, Latvia, Lithuania, Slovakia, Slovenia, Romania, Bulgaria | some        | some       | some        |
| Cedar Revolution               | 2      | Lebanon, Syria                                                    | some        | all        | some        |
| India-US Nuclear Deal          | 2      | India                                                             | all         | all        | all         |
| Fall of the Taliban            | 2      | Afghanistan                                                       | all         | all        | all         |
| Invasion of Iraq               | 2      | Iraq                                                              | all         | all        | all         |
| Curveball                      | 2      | Iraq                                                              | all         | all        | all         |
| Olympic Summer 2008            | 2      | Georgia                                                           | all         | all        | all         |
| Estonian Cyberattacks 2007     | 2      | Estonia                                                           | all         | all        | all         |
| Litvinenko Poisoning           | 2      | United Kingdom                                                    | all         | all        | all         |
| Ana Montes Unmasked            | 2      | Cuba                                                              | all         | all        | all         |
| North Korean Nuclear Test      | 2      | North Korea                                                       | none        | all        | none        |
| Petrocaribe                    | 2      | Venezuela                                                         | all         | all        | all         |
| Munich Speech 2007             | 2      | Germany                                                           | all         | all        | all         |
| Abu Ghraib                     | 2      | Iraq                                                              | all         | all        | all         |
| Natanz Revealed                | 2      | Iran                                                              | all         | all        | all         |
| Kosovo Declares Independence   | 2      | Kosovo                                                            | none        | none       | none        |
| Sovereign Wealth Funds         | 2      | Saudi Arabia, Qatar, United Arab Emirates                         | some        | some       | none        |
| Stuxnet                        | 3      | Iran                                                              | all         | all        | all         |
| Neptune Spear                  | 3      | Pakistan                                                          | all         | all        | all         |
| Nordic Accession               | 3      | Finland, Sweden                                                   | some        | some       | none        |
| AUKUS                          | 3      | Australia, United Kingdom                                         | some        | all        | some        |
| Private Constellation          | 3      | Ukraine                                                           | all         | all        | all         |
| Fall of the Assad Regime       | 3      | Syria                                                             | all         | all        | all         |
| Defence of Kyiv                | 3      | Ukraine                                                           | all         | all        | all         |
| Revolution of Dignity          | 3      | Ukraine                                                           | all         | all        | all         |
| Fall of the Caliphate          | 3      | Iraq, Syria                                                       | all         | all        | all         |
| Annexation of Crimea           | 3      | Crimea                                                            | all         | all        | all         |
| Full-Scale Invasion            | 3      | Ukraine                                                           | all         | all        | all         |
| Rare Earth Squeeze             | 3      | Japan                                                             | all         | all        | all         |
| Syrian Intervention            | 3      | Syria                                                             | all         | all        | all         |
| Fall of Kabul                  | 3      | Afghanistan                                                       | all         | all        | all         |
| Eurozone Crisis                | 3      | Greece                                                            | none        | all        | none        |
| Arab Spring                    | 3      | Tunisia, Egypt, Libya                                             | none        | some       | none        |
| Migration Crises               | 3      | Greece, Syria, Venezuela                                          | some        | all        | some        |
| Populist Wave                  | 3      | United Kingdom, Italy, Brazil                                     | some        | all        | some        |
| October 7 and Gaza             | 3      | Israel                                                            | all         | all        | all         |
| Cable Cut in the Baltic        | future | Finland, Estonia                                                  | all         | all        | some        |
| **Totals (all / some / none)** |        |                                                                   | 34 / 10 / 9 | 42 / 6 / 5 | 32 / 9 / 12 |

**Cards whose place is a home box**, on the board under every option: End of the Soviet Union, Handover of Hong
Kong, Golden Shield, Second Chechen War, Hainan Island Incident, Shock Therapy Backlash, Ruble Default (Era 1);
ABM Treaty Withdrawal, Peace Mission 2005, Chinese Anti-Satellite Test, China Joins the WTO, September 11, SARS
(Era 2); Ghost Stories, Chip
Chokepoint, Belt and Road, Global Financial Crisis, Hong Kong Security Law, Hypersonics on Parade, Tariff Shock
(Era 3). Olympic Summer 2008 is about both China and Georgia. The other cards name no place, or the whole world.

## How the tables were checked

By a script that is not part of the repository (it lives in the author's temporary folder and is not
committed). It reads each option file's country table and H2 rows and checks: the first line, the six region
names, every stability a whole number from 1 up, every neighbour a country in the table or a home box, every
link listed at both ends (under H1 and under H2), and, for each side, which countries a breadth-first search
from that side's home-box neighbours reaches through country-to-country links. It also counts countries,
battlegrounds, links, home-box neighbours and the battlegrounds next to them, the battlegrounds open at each
threshold under C1 to C3, and the card marks above. The command:

```
node %TEMP%\map-check-303\check.mjs docs/proposals/map-content/option-1.md docs/proposals/map-content/option-2.md docs/proposals/map-content/option-3.md
```

It reported no errors for any of the three files. Each option file's "Reach" section gives its result.

## The options side by side

|                                                  | Option 1       | Option 2       | Option 3                                                       |
| ------------------------------------------------ | -------------- | -------------- | -------------------------------------------------------------- |
| Countries (with a Crimea box)                    | 36 (37)        | 41 (42)        | 30 (31)                                                        |
| Battlegrounds                                    | 12             | 17             | 12                                                             |
| Countries per region                             | 6              | 4 to 8         | 5                                                              |
| Links between countries                          | 50             | 61             | 38                                                             |
| Next to the SAE box, H1 / H2                     | 14 / 3         | 16 / 3         | 11 / 3                                                         |
| Next to the LIO box                              | 3              | 3              | 3                                                              |
| Reachable from both home boxes                   | all, H1 and H2 | all, H1 and H2 | all but Japan and Taiwan (SAE only under H1; neither under H2) |
| Cards with all their places on the board (of 53) | 34             | 42             | 32                                                             |

## Questions for the owner

1. Which map content: option 1, 2, 3, or a mix (for example option 1's regions with some of option 2's
   countries)?
2. Do Russia's and China's borders decide which countries touch the SAE box (H1), or are they artwork only
   (H2)? Under H2, which countries touch the SAE box, and how many? Should the LIO box touch more than Canada,
   Mexico and Cuba?
3. Is Crimea its own box or part of Ukraine?
4. Which closing order: C1 (the dialogue's suggestion), C2, C3, or another?
5. Kosovo (Pristina Airport Dash, Kosovo Declares Independence) is on no option's board. Should it be its own
   box, part of Serbia's, or neither? Like Crimea, this is a political choice as well as a rules one.
6. Oslo Accords and October 7 and Gaza are listed under Israel. Should the Palestinian territories have their own
   box? The same kind of choice as questions 3 and 5.
7. Must every country be reachable by adjacency from both home boxes, or may a side's only way in be its
   starting influence (Taiwan in option 3)? The answer decides what the map's content check tests.
8. Are links across land with no country on the board, and long links across seas, acceptable, and should long
   links be few (option 3) or many (option 2)?
9. Who sets the real stabilities and battlegrounds: the owner, or a balance pass once the rules are built (the
   numbers here are placeholders)?
10. What are Taiwan's and Crimea's starting influence numbers?
