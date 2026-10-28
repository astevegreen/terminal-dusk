Proposal, not a rule

# Option B: balance-led

Part of the [map numbers proposal](README.md). Decides nothing. The numbers start from what makes the two sides
even, and use history only to choose between numbers that are equally even. The run file is
[option-b-balance.json](option-b-balance.json).

**The idea.** The SAE box touches 17 countries and the LIO box only 3 (Canada, Mexico, Cuba), so SAE can reach far
more of the map at the cost of 1. Option B makes the countries next to the SAE box harder to hold and the countries
on LIO's routes easier, flattens the stabilities towards 2 and 3, and gives every region the same number of
battlegrounds and the same amounts, so no single region decides the game.

## Stability

1 = easily swayed, 4 = very settled. Changes from the placeholders in `six-region-map.json` are marked "was N".

| Region                          | Countries                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Europe                          | United Kingdom 3 (was 4), France 3 (was 4), Germany 3 (was 4), Italy 3, Poland 3, Finland 4, Serbia 2, Greece 2                                              |
| Eastern Europe and Central Asia | Estonia 3, Belarus 3 (was 2), Ukraine 3 (was 2), Crimea 2, Georgia 3 (was 2), Azerbaijan 2, Kazakhstan 3 (was 2), Kyrgyzstan 2 (was 1), Tajikistan 2 (was 1) |
| Middle East and North Africa    | Turkey 3, Libya 2 (was 1), Israel 3 (was 4), Lebanon 2 (was 1), Syria 2, Iraq 2, Iran 3 (was 2), Saudi Arabia 3                                              |
| Sub-Saharan Africa              | Nigeria 2 (was 1), Rwanda 1, Somalia 1, South Africa 2 (was 3)                                                                                               |
| East and South Asia             | Japan 3 (was 4), South Korea 3, North Korea 3, Taiwan 2 (was 3), India 3, Pakistan 3 (was 2), Afghanistan 2 (was 1), Australia 3 (was 4)                     |
| The Americas                    | Canada 3 (was 4), Mexico 2, Cuba 2 (was 3), Venezuela 2, Brazil 2                                                                                            |

- 2 countries at stability 1, 18 at 2, 21 at 3 and 1 at 4 (Finland); the placeholders have 8, 15, 11 and 8.
- The SAE box's 17 neighbours add up to stability 46 (placeholders 40); the LIO box's three add up to 7
  (placeholders 9). Every SAE neighbour is now at least 2.
- Rwanda and Somalia stay at 1, as the two places the period's outside powers could not hold for long.

## Battlegrounds by era

Two in every region, in every era: 12 an era.

| Region                          | Era 1 (1991-2001)     | Era 2 (2001-2008)     | Era 3 (2008-2025)     |
| ------------------------------- | --------------------- | --------------------- | --------------------- |
| Eastern Europe and Central Asia | Ukraine, Kazakhstan   | Ukraine, Georgia      | Ukraine, Belarus      |
| East and South Asia             | Japan, India          | Pakistan, Afghanistan | Taiwan, South Korea   |
| Europe                          | Germany, Poland       | Germany, Serbia       | Germany, Greece       |
| Middle East and North Africa    | Iraq, Iran            | Iraq, Saudi Arabia    | Syria, Iran           |
| Sub-Saharan Africa              | Nigeria, South Africa | Nigeria, Somalia      | Nigeria, South Africa |
| The Americas                    | Mexico, Brazil        | Venezuela, Brazil     | Mexico, Venezuela     |
| **Total**                       | **12**                | **12**                | **12**                |

The future era (the 2025-2027 scenario) keeps Era 3's list. Ukraine, Germany and Nigeria are battlegrounds in every
era, so each region has one country that always matters and one that moves with the news.

## Region amounts

The same in every region. A side scores only its highest level, plus 1 for each battleground it controls there.

| Region       | Present | Ahead | Every battleground |
| ------------ | ------- | ----- | ------------------ |
| Every region | 2       | 4     | 6                  |

## Score track

- **Length:** 15 steps from the middle to each side's end (31 places).
- **Start:** the middle. Neither side starts ahead.
- **Most one era can move it:** one side holding every battleground everywhere, with the rival scoring nothing, is
  48 steps (6 regions x (6 + 2)). In real games far less: see the smoke runs in the README.

## Taiwan and Crimea at the start

| Country              | LIO | SAE | Who controls it at the start |
| -------------------- | --- | --- | ---------------------------- |
| Taiwan (stability 2) | 2   | 0   | LIO                          |
| Crimea (stability 2) | 0   | 2   | SAE                          |

Each side starts controlling one country, the mirror of the other: Taiwan starts LIO-aligned as the design says,
and Crimea's lean towards Russia in 1991 is read as SAE control.

## Trade-offs

- **For:** even by construction. Every region is worth the same, so the closing order at Escalation (the first
  three regions close) shuts prizes of equal size, and the score cannot be won in one big region. Fewer
  battlegrounds (12 against 17) make each one count for more and are easier to learn.
- **For:** the starting position is symmetric, so the start of the track can stay in the middle.
- **Against:** history is bent to fit. Germany, the UK and France at 3 are as easy to move as Iran or Kazakhstan;
  Taiwan at 2 is easier to move than in either other option. A player who knows the period may find that odd.
- **Against:** Crimea starting under SAE control is a reading of "as the history of 1991 says" that the owner may
  not share: in 1991 Crimea was part of Ukraine.
- **Against:** a short track (15) with an era swing of up to 48 may end games early at the first era's scoring,
  if a side gets far ahead. Only a scored game can tell.
- **Smoke run:** this is the only option where SAE ends ahead: 15.04 influence and 2.2 countries a game, against
  LIO's 9.96 and 1.52. On the placeholders LIO leads 20.23 to 9.66. So the offset more than cancels LIO's lead
  with the Easy AI; how far that holds for stronger players, and with scoring, is not known.
