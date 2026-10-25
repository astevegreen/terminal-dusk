Proposal, not a rule

# Option 3: compact, five countries per region

Part of the [map content proposal](README.md). Decides nothing. Every number is a placeholder that makes the
trade-offs concrete; the settled points, the adjacency conventions and the home-box options are in the README.

Five countries in every region, two battlegrounds in every region, and no long links across the Pacific or
the Indian Ocean: the smallest board of the three, and the quickest to read.

## Countries

Home-box neighbours below are under home-box option **H1** (borders decide). BG = battleground.

| Region                          | Country        | Stability | BG  | Neighbours                                        |
| ------------------------------- | -------------- | --------- | --- | ------------------------------------------------- |
| Europe                          | United Kingdom | 4         |     | France, Canada                                    |
| Europe                          | France         | 4         |     | United Kingdom, Germany                           |
| Europe                          | Germany        | 4         | BG  | France, Poland, Serbia                            |
| Europe                          | Poland         | 3         | BG  | Germany, Estonia, Belarus, Ukraine, SAE box       |
| Europe                          | Serbia         | 2         |     | Germany, Ukraine, Turkey                          |
| Eastern Europe and Central Asia | Estonia        | 3         |     | Poland, SAE box                                   |
| Eastern Europe and Central Asia | Belarus        | 2         |     | Poland, Ukraine, SAE box                          |
| Eastern Europe and Central Asia | Ukraine        | 2         | BG  | Poland, Serbia, Belarus, Georgia, Turkey, SAE box |
| Eastern Europe and Central Asia | Georgia        | 2         |     | Ukraine, Turkey, Iran, Kazakhstan, SAE box        |
| Eastern Europe and Central Asia | Kazakhstan     | 2         | BG  | Georgia, Afghanistan, SAE box                     |
| Middle East and North Africa    | Turkey         | 3         |     | Serbia, Ukraine, Georgia, Syria, Iraq, Iran       |
| Middle East and North Africa    | Israel         | 4         |     | Syria, Ethiopia                                   |
| Middle East and North Africa    | Syria          | 2         |     | Turkey, Israel, Iraq                              |
| Middle East and North Africa    | Iraq           | 2         | BG  | Turkey, Syria, Iran                               |
| Middle East and North Africa    | Iran           | 2         | BG  | Turkey, Georgia, Iraq, Afghanistan, Pakistan      |
| Sub-Saharan Africa              | Nigeria        | 1         | BG  | DR Congo, Brazil                                  |
| Sub-Saharan Africa              | DR Congo       | 1         |     | Nigeria, Rwanda, South Africa                     |
| Sub-Saharan Africa              | Rwanda         | 1         |     | DR Congo, Ethiopia                                |
| Sub-Saharan Africa              | Ethiopia       | 2         |     | Rwanda, Israel                                    |
| Sub-Saharan Africa              | South Africa   | 3         | BG  | DR Congo                                          |
| East and South Asia             | Japan          | 4         | BG  | Taiwan, SAE box                                   |
| East and South Asia             | Taiwan         | 3         |     | Japan, SAE box                                    |
| East and South Asia             | India          | 3         | BG  | Pakistan, SAE box                                 |
| East and South Asia             | Pakistan       | 2         |     | India, Afghanistan, Iran, SAE box                 |
| East and South Asia             | Afghanistan    | 1         |     | Pakistan, Iran, Kazakhstan, SAE box               |
| The Americas                    | Canada         | 4         |     | United Kingdom, LIO box                           |
| The Americas                    | Mexico         | 2         | BG  | Cuba, Venezuela, LIO box                          |
| The Americas                    | Cuba           | 3         |     | Mexico, Venezuela, LIO box                        |
| The Americas                    | Venezuela      | 2         |     | Mexico, Cuba, Brazil                              |
| The Americas                    | Brazil         | 2         | BG  | Venezuela, Nigeria                                |

**Totals:** 30 countries (5 per region), 12 battlegrounds (2 per region); 31 and 12 if Crimea is its own box.

**Links that cross a country not on the board:** Germany-Serbia and Serbia-Ukraine (Central Europe),
Poland-Estonia (Lithuania and Latvia), Serbia-Turkey (Bulgaria), Georgia-Iran (Armenia and Azerbaijan),
Georgia-Kazakhstan (Azerbaijan and the Caspian), Kazakhstan-Afghanistan (Uzbekistan and Turkmenistan),
Israel-Ethiopia (Egypt, Sudan and the Red Sea), Nigeria-DR Congo, DR Congo-South Africa, Rwanda-Ethiopia,
Mexico-Venezuela (Central America and Colombia).
**Long links:** United Kingdom-Canada (North Atlantic), Brazil-Nigeria (South Atlantic), Ukraine-Turkey and
Ukraine-Georgia (Black Sea), Cuba-Venezuela (Caribbean).

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

| Country     | Neighbours under H2                      |
| ----------- | ---------------------------------------- |
| Poland      | Germany, Estonia, Belarus, Ukraine       |
| Estonia     | Poland                                   |
| Ukraine     | Poland, Serbia, Belarus, Georgia, Turkey |
| Georgia     | Ukraine, Turkey, Iran, Kazakhstan        |
| Japan       | Taiwan                                   |
| Taiwan      | Japan                                    |
| India       | Pakistan                                 |
| Afghanistan | Pakistan, Iran, Kazakhstan               |

## Reach

Checked by the script described in the README ("How the tables were checked").

- **Symmetric:** yes, every link is listed at both ends, under H1 and under H2.
- **Under H1:** every country can be reached by adjacency from the SAE box. From the LIO box every country
  except **Japan and Taiwan** can be reached: their only links are to each other and to the SAE box.
- **Under H2:** Japan and Taiwan can be reached from **neither** home box; every other country from both.
- What LIO would still have there: Taiwan starts LIO-aligned, and influence lets a side place in that country
  and next to it, so LIO could still place in Taiwan and Japan from Taiwan's starting influence. If that
  influence is ever removed to 0 and LIO has none in Japan, LIO cannot place there again except by card events.
  An intervention or realignment needs no adjacency, so both remain possible there.

## Trade-offs

**Cards whose place is on the board.** Of the 52 cards in the README's card table, 31 have all their places on
this board, 9 some and 12 none.

- **Some:** NATO Enlargement 1999 (Poland only), Desert Storm Coalition (Iraq, not Kuwait), Shanghai Five
  (Kazakhstan only), Big Bang Enlargement 2004 (Estonia only), Cedar Revolution (Syria, not Lebanon), AUKUS (the
  United Kingdom, not Australia), Migration Crises (not Greece), Populist Wave (not Italy), Cable Cut in the
  Baltic (Estonia, not Finland).
- **None:** Maastricht Treaty (Netherlands), Battle of Mogadishu (Somalia), Pristina Airport Dash and Kosovo
  Declares Independence (Kosovo), Asian Financial Crisis (Thailand), Al Jazeera Launches (Qatar), Libya Disarms
  (Libya), North Korean Nuclear Test (North Korea), Sovereign Wealth Funds (no Gulf state), Nordic Accession
  (Finland, Sweden), Eurozone Crisis (Greece), Arab Spring (Tunisia, Egypt, Libya).

**Balance of starting reach.** "Next to it" is where a side may place from the start without any influence;
"one step further" is the battlegrounds next to those countries.

| Home box | Home-box option | Countries next to it | Battlegrounds next to it                      | Battlegrounds one step further   |
| -------- | --------------- | -------------------- | --------------------------------------------- | -------------------------------- |
| LIO      | H1 or H2        | 3                    | 1 (Mexico)                                    | 0                                |
| SAE      | H1              | 11                   | 5 (Poland, Ukraine, Kazakhstan, Japan, India) | 2 (Germany, Iran)                |
| SAE      | H2              | 3                    | 1 (Kazakhstan)                                | 4 (Poland, Ukraine, India, Iran) |

The smallest board makes the H1 gap the largest in share: the SAE box starts next to 11 of 30 countries and 5
of 12 battlegrounds, and LIO's nearest battleground after Mexico is Brazil, two steps out.

**Phone-first zoom.** Five boxes per region fit a 3 + 2 layout or one row of five; on 844 x 390, with the same
assumed 100 px for the top bar and the hand's handle, a 3 + 2 layout gives boxes of about 280 x 145 px, as in
option 1, with one slot free for a region label or legend. Zoomed out: 30 badges and two home boxes, with no link crossing the Pacific, so
the map need not wrap.

**Closing order (README, C1 to C3).** As in option 1, two battlegrounds per region: 10 stay open at level 3, 8
at 4 and 6 at Brink under every order, and 15 of the 30 countries are closed at Brink.

| Region                          | Battlegrounds         | C1 closes at | C2 closes at | C3 closes at |
| ------------------------------- | --------------------- | ------------ | ------------ | ------------ |
| Europe                          | Germany, Poland       | 5            | open         | open         |
| Eastern Europe and Central Asia | Ukraine, Kazakhstan   | 3            | open         | 4            |
| Middle East and North Africa    | Iraq, Iran            | open         | 5            | 5            |
| Sub-Saharan Africa              | Nigeria, South Africa | open         | 3            | open         |
| East and South Asia             | Japan, India          | 4            | open         | 3            |
| The Americas                    | Mexico, Brazil        | open         | 4            | open         |

In a closed region placing goes on, but influence there can then be removed only by card events, so a lead
held when it closes tends to last.

- **C1** and **C3** close East and South Asia at 3 or 4. There LIO's only way in by placement is Taiwan's
  starting influence (Reach, above), so once the region closes, LIO cannot use interventions or realignments to
  make up for that.
- **C2** keeps East and South Asia open to the end, so the region where LIO places hardest stays open to
  interventions and realignments, while the Americas, next to the LIO box, close at 4.

**Scenario-data work for the rules lane.** 30 country entries (31 with a Crimea box), 38 adjacency pairs
between countries, two home-box neighbour lists (3 and 11 under H1), three region IDs for the closing order, and
the starting numbers for Taiwan and Crimea. The least artwork: five long links, none across the Pacific. The
content check that W7 map option A describes ("every country is reachable from a home box") would pass under
H1, since the SAE box reaches everything, but a check per side would flag Japan and Taiwan for LIO; under H2
even that check would fail. The rules lane would need to know which check the owner wants.
