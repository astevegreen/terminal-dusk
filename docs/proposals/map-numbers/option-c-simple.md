Proposal, not a rule

# Option C: simple and flat

Part of the [map numbers proposal](README.md). Decides nothing. Option C changes as little as it can: it keeps the
map's placeholder stabilities and starting influence, keeps the placeholder battleground list for Era 1, and swaps
a few battlegrounds in each later era. Every region scores the same amounts. The run file is
[option-c-simple.json](option-c-simple.json).

**The idea.** The placeholders are already one coherent set (option 2 of the map-content proposal), and the scoring
rules are new. Keeping the map steady and the amounts flat means the first scored games test the scoring rules,
not a new map at the same time; the owner or a balance pass tunes from there.

## Stability

Unchanged from `six-region-map.json`. 1 = easily swayed, 4 = very settled.

| Region                          | Countries                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Europe                          | United Kingdom 4, France 4, Germany 4, Italy 3, Poland 3, Finland 4, Serbia 2, Greece 2                      |
| Eastern Europe and Central Asia | Estonia 3, Belarus 2, Ukraine 2, Crimea 2, Georgia 2, Azerbaijan 2, Kazakhstan 2, Kyrgyzstan 1, Tajikistan 1 |
| Middle East and North Africa    | Turkey 3, Libya 1, Israel 4, Lebanon 1, Syria 2, Iraq 2, Iran 2, Saudi Arabia 3                              |
| Sub-Saharan Africa              | Nigeria 1, Rwanda 1, Somalia 1, South Africa 3                                                               |
| East and South Asia             | Japan 4, South Korea 3, North Korea 3, Taiwan 3, India 3, Pakistan 2, Afghanistan 1, Australia 4             |
| The Americas                    | Canada 4, Mexico 2, Cuba 3, Venezuela 2, Brazil 2                                                            |

8 countries at stability 1, 15 at 2, 11 at 3 and 8 at 4 (total 103). The SAE box's 17 neighbours add up to 40, the
LIO box's three to 9.

## Battlegrounds by era

17 in every era; Era 1 is the placeholder list. Each later era swaps a few countries in the same region, so the count
per region never changes (3, except Sub-Saharan Africa with 2).

| Region                          | Era 1 (1991-2001)            | Era 2 (2001-2008)            | Era 3 (2008-2025)         |
| ------------------------------- | ---------------------------- | ---------------------------- | ------------------------- |
| Eastern Europe and Central Asia | Ukraine, Georgia, Kazakhstan | Ukraine, Georgia, Kyrgyzstan | Ukraine, Georgia, Crimea  |
| East and South Asia             | Japan, Taiwan, India         | Afghanistan, Taiwan, India   | Japan, Taiwan, India      |
| Europe                          | Germany, Poland, Serbia      | Germany, Poland, France      | Germany, Poland, Greece   |
| Middle East and North Africa    | Syria, Iraq, Iran            | Saudi Arabia, Iraq, Iran     | Syria, Iraq, Iran         |
| Sub-Saharan Africa              | Nigeria, South Africa        | Nigeria, Somalia             | Nigeria, South Africa     |
| The Americas                    | Mexico, Venezuela, Brazil    | Mexico, Venezuela, Brazil    | Mexico, Venezuela, Brazil |
| **Total**                       | **17**                       | **17**                       | **17**                    |

The future era (the 2025-2027 scenario) keeps Era 3's list. Five countries change from Era 1 to Era 2 (the
Afghanistan war, the colour revolutions, the split over Iraq, the Gulf states and the Horn of Africa); Era 3 brings
back Japan, Syria and South Africa and brings in Crimea and Greece. The Americas never change.

## Region amounts

The same in every region. A side scores only its highest level, plus 1 for each battleground it controls there.

| Region       | Present | Ahead | Every battleground |
| ------------ | ------- | ----- | ------------------ |
| Every region | 1       | 3     | 5                  |

## Score track

- **Length:** 20 steps from the middle to each side's end (41 places).
- **Start:** the middle. Neither side starts ahead.
- **Most one era can move it:** one side holding every battleground everywhere, with the rival scoring nothing, is
  47 steps (6 regions x 5, plus 17 battlegrounds). In real games far less: see the smoke runs in the README.

## Taiwan and Crimea at the start

Unchanged from the map data.

| Country              | LIO | SAE | Who controls it at the start            |
| -------------------- | --- | --- | --------------------------------------- |
| Taiwan (stability 3) | 3   | 0   | LIO                                     |
| Crimea (stability 2) | 0   | 1   | Nobody: SAE has a foothold, not control |

## Trade-offs

- **For:** the least to learn and the least to change. The scenario file would only gain the later eras' lists and
  the amounts and track, and the map stays as the owner already saw it in option 2.
- **For:** a fixed count of battlegrounds per region keeps "ahead" and "every battleground" equally hard to reach
  in every era, so era-to-era differences come from the cards, not the map.
- **Against:** LIO's lead on the placeholders stays as it is (the smoke run below), because the SAE box's reach
  is not offset. Flat amounts also make the small regions (Sub-Saharan Africa, with 4 countries and 2
  battlegrounds) as valuable as the large ones, and every-battleground there needs only 2 countries.
- **Against:** the swaps are few, so the eras feel less different than in option A.
- **Smoke run:** the same games as the placeholders, to the decimal (LIO 20.23 influence and 3.67 countries,
  SAE 9.66 and 1.81): stability and starting influence are unchanged, and battlegrounds do not change play yet
  (Escalation rising for a battleground is not built, and the Easy AI does not aim at them). Only the era-end
  battleground counts differ, in Eras 2 and 3.
