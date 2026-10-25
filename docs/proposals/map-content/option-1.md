Proposal, not a rule

# Option 1: even regions, six countries each

Part of the [map content proposal](README.md). Decides nothing. Every number is a placeholder that makes the
trade-offs concrete; the settled points, the adjacency conventions and the home-box options are in the README.

Six countries in every region, two battlegrounds in every region. The shape follows the placeholders of W7 map
option A, which the owner chose.

## Countries

Home-box neighbours below are under home-box option **H1** (borders decide). BG = battleground.

| Region                          | Country        | Stability | BG  | Neighbours                                                             |
| ------------------------------- | -------------- | --------- | --- | ---------------------------------------------------------------------- |
| Europe                          | United Kingdom | 4         |     | France, Canada                                                         |
| Europe                          | France         | 4         |     | United Kingdom, Germany                                                |
| Europe                          | Germany        | 4         | BG  | France, Poland, Finland, Serbia                                        |
| Europe                          | Poland         | 3         | BG  | Germany, Estonia, Belarus, Ukraine, Serbia, SAE box                    |
| Europe                          | Finland        | 4         |     | Germany, Estonia, SAE box                                              |
| Europe                          | Serbia         | 2         |     | Germany, Poland, Turkey                                                |
| Eastern Europe and Central Asia | Estonia        | 3         |     | Poland, Finland, SAE box                                               |
| Eastern Europe and Central Asia | Belarus        | 2         |     | Poland, Ukraine, SAE box                                               |
| Eastern Europe and Central Asia | Ukraine        | 2         | BG  | Poland, Belarus, Georgia, Turkey, SAE box                              |
| Eastern Europe and Central Asia | Georgia        | 2         |     | Ukraine, Turkey, Iran, SAE box                                         |
| Eastern Europe and Central Asia | Kazakhstan     | 2         | BG  | Kyrgyzstan, Iran, Afghanistan, SAE box                                 |
| Eastern Europe and Central Asia | Kyrgyzstan     | 1         |     | Kazakhstan, Afghanistan, SAE box                                       |
| Middle East and North Africa    | Turkey         | 3         |     | Serbia, Ukraine, Georgia, Syria, Iraq, Iran                            |
| Middle East and North Africa    | Israel         | 4         |     | Syria, Saudi Arabia                                                    |
| Middle East and North Africa    | Syria          | 2         |     | Turkey, Israel, Iraq                                                   |
| Middle East and North Africa    | Iraq           | 2         | BG  | Turkey, Syria, Iran, Saudi Arabia                                      |
| Middle East and North Africa    | Iran           | 2         | BG  | Turkey, Georgia, Kazakhstan, Iraq, Saudi Arabia, Afghanistan, Pakistan |
| Middle East and North Africa    | Saudi Arabia   | 3         |     | Israel, Iraq, Iran, Somalia                                            |
| Sub-Saharan Africa              | Nigeria        | 1         | BG  | DR Congo, Brazil                                                       |
| Sub-Saharan Africa              | DR Congo       | 1         |     | Nigeria, Rwanda, South Africa                                          |
| Sub-Saharan Africa              | Rwanda         | 1         |     | DR Congo, Ethiopia                                                     |
| Sub-Saharan Africa              | Ethiopia       | 2         |     | Rwanda, Somalia                                                        |
| Sub-Saharan Africa              | Somalia        | 1         |     | Ethiopia, Saudi Arabia                                                 |
| Sub-Saharan Africa              | South Africa   | 3         | BG  | DR Congo                                                               |
| East and South Asia             | Japan          | 4         | BG  | South Korea, Taiwan, Canada, SAE box                                   |
| East and South Asia             | South Korea    | 3         |     | Japan, SAE box                                                         |
| East and South Asia             | Taiwan         | 3         |     | Japan, SAE box                                                         |
| East and South Asia             | India          | 3         | BG  | Pakistan, SAE box                                                      |
| East and South Asia             | Pakistan       | 2         |     | India, Afghanistan, Iran, SAE box                                      |
| East and South Asia             | Afghanistan    | 1         |     | Pakistan, Iran, Kazakhstan, Kyrgyzstan, SAE box                        |
| The Americas                    | Canada         | 4         |     | United Kingdom, Japan, LIO box                                         |
| The Americas                    | Mexico         | 2         | BG  | Cuba, Colombia, LIO box                                                |
| The Americas                    | Cuba           | 3         |     | Mexico, Venezuela, LIO box                                             |
| The Americas                    | Venezuela      | 2         |     | Cuba, Colombia, Brazil                                                 |
| The Americas                    | Colombia       | 2         |     | Mexico, Venezuela, Brazil                                              |
| The Americas                    | Brazil         | 2         | BG  | Venezuela, Colombia, Nigeria                                           |

**Totals:** 36 countries (6 per region), 12 battlegrounds (2 per region); 37 and 12 if Crimea is its own box.

**Links that cross a country not on the board:** Germany-Finland and Poland-Estonia (the Baltic and its states),
Germany-Serbia and Poland-Serbia (Central Europe), Serbia-Turkey (Bulgaria), Georgia-Iran (Armenia and
Azerbaijan), Kazakhstan-Iran and Kazakhstan-Afghanistan (Turkmenistan and Uzbekistan), Kyrgyzstan-Afghanistan
(Tajikistan), Israel-Saudi Arabia (Jordan), Saudi Arabia-Somalia (Yemen), Nigeria-DR Congo, DR Congo-South
Africa, Rwanda-Ethiopia, Mexico-Colombia (Central America); South Korea-SAE box (North Korea).
**Long links:** United Kingdom-Canada (North Atlantic), Canada-Japan (North Pacific), Brazil-Nigeria (South
Atlantic), Ukraine-Turkey and Ukraine-Georgia (Black Sea), Cuba-Venezuela (Caribbean).

## Taiwan and Crimea

- **Taiwan** is its own box in East and South Asia (row above). Starting influence: LIO-aligned (settled); the
  number is open.
- **Crimea** is shown as part of Ukraine (row above). If it is its own box, the question in the README, the row
  would be the one below, and Ukraine's row would add Crimea. Starting influence: as the history of 1991 says
  (settled); the number is open.

| Region                          | Country                      | Stability | BG  | Neighbours               |
| ------------------------------- | ---------------------------- | --------- | --- | ------------------------ |
| Eastern Europe and Central Asia | Crimea (only if its own box) | open      |     | Ukraine, Turkey, SAE box |

## Under home-box option H2 (changed rows only)

H2's example list gives the SAE box three countries, as many as the LIO box: Belarus, Kazakhstan, Pakistan.
These rows lose "SAE box"; every other row is unchanged.

| Country     | Neighbours under H2                        |
| ----------- | ------------------------------------------ |
| Poland      | Germany, Estonia, Belarus, Ukraine, Serbia |
| Finland     | Germany, Estonia                           |
| Estonia     | Poland, Finland                            |
| Ukraine     | Poland, Belarus, Georgia, Turkey           |
| Georgia     | Ukraine, Turkey, Iran                      |
| Kyrgyzstan  | Kazakhstan, Afghanistan                    |
| Japan       | South Korea, Taiwan, Canada                |
| South Korea | Japan                                      |
| Taiwan      | Japan                                      |
| India       | Pakistan                                   |
| Afghanistan | Pakistan, Iran, Kazakhstan, Kyrgyzstan     |

## Reach

Checked by the script described in the README ("How the tables were checked").

- **Symmetric:** yes, every link is listed at both ends, under H1 and under H2.
- **Under H1:** every country can be reached by adjacency from the LIO box, and every country from the SAE box.
  No country or group is reachable by one side only.
- **Under H2:** the same: every country can be reached from both home boxes.
- The Canada-Japan long link carries this. Without it, Japan, South Korea and Taiwan would be reachable from the
  SAE box only under H1, and from neither box under H2 (LIO would still reach Taiwan's neighbours through its
  starting influence there).

## Trade-offs

**Cards whose place is on the board.** Of the 53 cards in the README's card table (cards that name a place off
the home boxes), 34 have all their places on this board, 10 some and 9 none.

- **Some:** NATO Enlargement 1999 (Poland only), Desert Storm Coalition (Iraq, not Kuwait), Shanghai Five (not
  Tajikistan), Big Bang Enlargement 2004 (Estonia only), Cedar Revolution (Syria, not Lebanon), Sovereign Wealth
  Funds (Saudi Arabia only), Nordic Accession (Finland, not Sweden), AUKUS (the United Kingdom, not Australia),
  Migration Crises (not Greece), Populist Wave (not Italy).
- **None:** Maastricht Treaty (Netherlands), Pristina Airport Dash and Kosovo Declares Independence (Kosovo),
  Asian Financial Crisis (Thailand), Al Jazeera Launches (Qatar), Libya Disarms (Libya), North Korean Nuclear
  Test (North Korea), Eurozone Crisis (Greece), Arab Spring (Tunisia, Egypt, Libya).

**Balance of starting reach.** "Next to it" is where a side may place from the start without any influence;
"one step further" is the battlegrounds next to those countries.

| Home box | Home-box option | Countries next to it | Battlegrounds next to it                      | Battlegrounds one step further   |
| -------- | --------------- | -------------------- | --------------------------------------------- | -------------------------------- |
| LIO      | H1 or H2        | 3                    | 1 (Mexico)                                    | 1 (Japan, through Canada)        |
| SAE      | H1              | 14                   | 5 (Poland, Ukraine, Kazakhstan, Japan, India) | 2 (Germany, Iran)                |
| SAE      | H2              | 3                    | 1 (Kazakhstan)                                | 4 (Poland, Ukraine, Iran, India) |

Under H1 the SAE box starts next to more than a third of the board and LIO next to one region; under H2 the two
boxes start level. Starting influence (out of scope here) is the other lever on this balance.

**Phone-first zoom.** Six boxes per region fit a 3 x 2 grid in a zoomed-in region. On 844 x 390, if about 100 px
of height goes to the top bar and the hand's handle (an assumption, not a measured layout), each box is about
280 x 145 px: room for the name, the stability and both influence numbers with large tap targets. Zoomed out:
36 badges and two home boxes. The Canada-Japan link crosses the map's edge, so the artwork needs a way to show
it (for example the Pacific drawn at both ends).

**Closing order (README, C1 to C3).** With two battlegrounds per region, every closing takes two battlegrounds
out of interventions: 10 stay open at level 3, 8 at 4 and 6 at Brink under every order. Since only an
intervention in a battleground raises Escalation, the climb past 5 always stays possible. What differs is where
the fight goes:

| Region                          | Battlegrounds         | C1 closes at | C2 closes at | C3 closes at |
| ------------------------------- | --------------------- | ------------ | ------------ | ------------ |
| Europe                          | Germany, Poland       | 5            | open         | open         |
| Eastern Europe and Central Asia | Ukraine, Kazakhstan   | 3            | open         | 4            |
| Middle East and North Africa    | Iraq, Iran            | open         | 5            | 5            |
| Sub-Saharan Africa              | Nigeria, South Africa | open         | 3            | open         |
| East and South Asia             | Japan, India          | 4            | open         | 3            |
| The Americas                    | Mexico, Brazil        | open         | 4            | open         |

In a closed region placing goes on, but influence there can then be removed only by card events, so a lead
held when it closes tends to last, and the side that places there more cheaply (next to its home box or its
influence) gains.

- **C1:** the two regions where every country touches the SAE box under H1 close first, so from level 4 a lead
  SAE builds by placing there can no longer be undone by interventions or realignments. At Brink the open
  regions are the Middle East, Sub-Saharan Africa and the Americas.
- **C2:** the regions the SAE box does not touch close first, the Americas (LIO's only home-box neighbours) at
  level 4. At Brink the open regions are Europe, Eastern Europe and Central Asia, and East and South Asia: every
  country the SAE box touches under H1.
- **C3:** East and South Asia closes first, freezing Japan, India and Taiwan; at Brink Europe, Sub-Saharan
  Africa and the Americas stay open.

**Scenario-data work for the rules lane.** 36 country entries (37 with a Crimea box), 50 adjacency pairs
between countries, two home-box neighbour lists (3 and 14 under H1), three region IDs for the closing order, and
the starting numbers for Taiwan and Crimea. Links across countries not on the board and the long links need
drawn lines in the artwork. The content check W7 map option A describes (symmetric adjacency, every
country reachable from a home box) passes as it stands.
