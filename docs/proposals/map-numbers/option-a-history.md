Proposal, not a rule

# Option A: history-led

Part of the [map numbers proposal](README.md). Decides nothing. The numbers follow what each country and each era
was like, then the trade-offs say what that costs in play. The run file is
[option-a-history.json](option-a-history.json).

**The idea.** A country's stability says how hard its politics were to move in those years. Each era's battlegrounds
are the places that era's history turned on. Regions that mattered most to the contest score more.

## Stability

1 = easily swayed, 4 = very settled. Changes from the placeholders in `six-region-map.json` are marked "was N".

| Region                          | Countries                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Europe                          | United Kingdom 4, France 4, Germany 4, Italy 3, Poland 3, Finland 4, Serbia 2, Greece 3 (was 2)                                      |
| Eastern Europe and Central Asia | Estonia 3, Belarus 3 (was 2), Ukraine 2, Crimea 2, Georgia 1 (was 2), Azerbaijan 2, Kazakhstan 3 (was 2), Kyrgyzstan 1, Tajikistan 1 |
| Middle East and North Africa    | Turkey 3, Libya 1, Israel 4, Lebanon 1, Syria 2, Iraq 1 (was 2), Iran 3 (was 2), Saudi Arabia 3                                      |
| Sub-Saharan Africa              | Nigeria 1, Rwanda 1, Somalia 1, South Africa 3                                                                                       |
| East and South Asia             | Japan 4, South Korea 3, North Korea 4 (was 3), Taiwan 3, India 3, Pakistan 2, Afghanistan 1, Australia 4                             |
| The Americas                    | Canada 4, Mexico 2, Cuba 3, Venezuela 2, Brazil 2                                                                                    |

Why the changes: Belarus, Kazakhstan, Iran and North Korea had governments that held on through the whole period;
Georgia and Iraq went through wars and changes of government; Greece came through its debt crisis as a fixed member
of the European and Atlantic clubs. Seven countries change; the total rises from 103 to 106.

## Battlegrounds by era

| Region                          | Era 1 (1991-2001)                 | Era 2 (2001-2008)                         | Era 3 (2008-2025)                    |
| ------------------------------- | --------------------------------- | ----------------------------------------- | ------------------------------------ |
| Eastern Europe and Central Asia | Ukraine, Georgia, Kazakhstan      | Ukraine, Georgia, Kyrgyzstan              | Ukraine, Crimea, Belarus, Kazakhstan |
| East and South Asia             | Japan, North Korea, Taiwan, India | North Korea, India, Pakistan, Afghanistan | Japan, Taiwan, India                 |
| Europe                          | Germany, Poland, Serbia           | Germany, France, Poland                   | Germany, Poland, Greece              |
| Middle East and North Africa    | Iraq, Iran, Israel                | Iraq, Iran, Lebanon, Saudi Arabia         | Turkey, Libya, Syria, Iran           |
| Sub-Saharan Africa              | Rwanda, Nigeria, South Africa     | Nigeria, Somalia, South Africa            | Nigeria, South Africa                |
| The Americas                    | Mexico, Cuba, Brazil              | Mexico, Venezuela, Brazil                 | Mexico, Venezuela, Brazil            |
| **Total**                       | **19**                            | **20**                                    | **19**                               |

The future era (the 2025-2027 scenario) keeps Era 3's list.

Why: Era 1 has the break-up of the old order, reunified Germany, the Balkan wars, the Gulf war, the end of apartheid,
the Rwandan genocide, the first North Korean nuclear crisis and the Taiwan Strait crisis. Era 2 has the colour
revolutions, the split over the Iraq war, the wars in Afghanistan and Iraq, the Lebanese withdrawal and the turn in
Venezuela. Era 3 has the Crimea annexation, the protests in Belarus and Kazakhstan, the Greek crisis, the Arab
uprisings and the wars in Libya and Syria, and the pressure on Taiwan.

## Region amounts

A side scores only its highest level in a region, plus 1 for each battleground it controls there.

| Region                          | Present | Ahead | Every battleground |
| ------------------------------- | ------- | ----- | ------------------ |
| Eastern Europe and Central Asia | 2       | 5     | 8                  |
| East and South Asia             | 2       | 5     | 8                  |
| Europe                          | 2       | 5     | 8                  |
| Middle East and North Africa    | 2       | 4     | 6                  |
| Sub-Saharan Africa              | 1       | 3     | 4                  |
| The Americas                    | 1       | 3     | 5                  |

The three regions that can close at Escalation are worth the most, so closing one shuts a big prize.

## Score track

- **Length:** 20 steps from the middle to each side's end (41 places).
- **Start:** 2 steps towards LIO, for the lead the West had in 1991.
- **Most one era can move it:** one side holding every battleground everywhere, with the rival scoring nothing, is
  58 steps in Eras 1 and 3 and 59 in Era 2. In real games far less: see the smoke runs in the README.

## Taiwan and Crimea at the start

| Country              | LIO | SAE | Who controls it at the start            |
| -------------------- | --- | --- | --------------------------------------- |
| Taiwan (stability 3) | 3   | 0   | LIO                                     |
| Crimea (stability 2) | 0   | 1   | Nobody: SAE has a foothold, not control |

This is the placeholder already in the map data: in 1991 Taiwan sat firmly with the West, while Crimea belonged to
Ukraine but leaned towards Russia.

## Trade-offs

- **For:** every number has a reason a player can look up, which fits a game that teaches its period. Battlegrounds
  move to where the news was, so each era feels different. Era 2's list turns towards Afghanistan, Pakistan and the
  Gulf, as that era did.
- **Against:** the lists are uneven (2 to 4 battlegrounds a region), and the counts are big (19-20 an era against
  the placeholders' 17). The LIO box touches only Canada, Mexico and Cuba, while SAE's touches 17 countries, and
  option A does not set out to even that out. The SAE box's 17 neighbours add up to stability 42 (placeholders 40),
  LIO's three to 9 (the same).
- **Smoke run:** SAE ends with more influence than on the placeholders (11.2 against 9.66 a game), LIO with about
  the same (20.26 against 20.23). LIO still controls about twice as many countries (3.5 against 1.84).
- **Against:** the 2-step start for LIO is a thumb on the scale that only a scored game can test.
- **Against:** Georgia, Iraq and Afghanistan at stability 1 are cheap to take, and two of them are battlegrounds in
  Era 2. Easy targets next to the SAE box may make Era 2 lopsided.
- **Unknown until scoring exists:** whether 20 steps is a long enough track when an era can move it by up to 58.
