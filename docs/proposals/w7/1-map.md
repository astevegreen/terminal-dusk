Proposal, not a rule

# Topic 1: the map (regions, how many countries, adjacency)

Part of the [W7 proposal](README.md). Decides nothing.

Every option here keeps what is settled: the topology is rules data in the content package (countries, regions,
adjacency, stability, battlegrounds; Decision 4), the artwork is separate and keyed by country ID, and the map is
drawn phone-first with net-influence badges zoomed out and full boxes zoomed in (Decision 6). Every stability is a
whole number from 1 upwards (Decision 1). Country and region names are real places only.

All counts below are placeholders to make the trade-offs concrete.

## Option A: six regions, about 36 countries, adjacency between neighbours

- **Regions (6):** Europe; Eastern Europe and Central Asia; the Middle East and North Africa; Sub-Saharan Africa;
  East and South Asia (with Oceania); the Americas.
- **Countries:** about 6 per region, about 36 in all. About 2 per region are battlegrounds.
- **Adjacency:** each country lists its neighbours (land borders and short sea crossings), plus a few long links
  that the period made important, for example Venezuela to Cuba.
- **Home boxes:** the United States (LIO) and Russia and China (SAE) are not countries on the board; they are home
  boxes that every country next to them counts as adjacent to. Influence can always be placed next to home.

**Fit with the era files.** Helps the cards whose history happens in one or two named places: Budapest
Memorandum and Annexation of Crimea (Ukraine), NATO Enlargement 1999 (Poland, Hungary, the Czech Republic), Taiwan
Strait Crisis, Cedar Revolution (Lebanon), Petrocaribe (Venezuela), Natanz Revealed and Stuxnet (Iran), Invasion of
Iraq, Syrian Intervention and Fall of the Assad Regime (Syria), Fall of Kabul (Afghanistan), Nordic Accession
(Finland, Sweden). With 36 countries most of them can have their place on the board. Strains the cards whose
story is worldwide (Kyoto Protocol, COVID-19, Paris Agreement, Smartphones and Social Networks, Tariff Shock): they
have no one place to act on, so a later rewording would make them act on a region, on battlegrounds, or on points.
Handover of Hong Kong and Hong Kong Security Law need Hong Kong as its own box or as part of China's home box, a
question below.

**Phone-first.** Six countries per region fit one zoomed-in region on an 844 x 390 screen as six full boxes with
large tap targets. Zoomed out, 36 badges plus two home boxes is busy but readable if badges show one number each
(net influence, Decision 6). Adjacency lines are hard to see zoomed out; they would show only zoomed in, or as
a highlight of legal targets while a player is placing.

**Engine work.** A map schema in `packages/content/schema` (country ID, region, stability, battleground flag,
neighbour list) and a `map` key in the scenario schema (rejected today). A content check that adjacency is
symmetric and every country is reachable from a home box. A public-state field for influence per country and side
(public compartment, so views need no filtering). Adjacency is only read by the placement rule (topic 2), so it
needs no step type of its own; a `placementAllowed` hook (Decision 4's hook list) lets cards change it.

**Game length.** The most countries of the three options, so the most placing decisions each turn. A turn's
actions spread wide, and a game is long; this is the closest to a classic full board.

## Option B: four regions, about 24 countries, adjacency within a region only

- **Regions (4):** Europe (including Eastern Europe and the Caucasus); the Middle East and Africa; Asia and the
  Pacific (including Central Asia); the Americas.
- **Countries:** about 6 per region, about 24 in all, about 2 battlegrounds per region.
- **Adjacency:** every country in a region is adjacent to every other country in it; regions touch only through
  named crossing countries (for example Turkey between Europe and the Middle East).

**Fit with the era files.** Helps the same named-place cards as option A where their country makes the cut, but
24 countries means choices: with six boxes for the whole of the Middle East and Africa, Rwandan Genocide, Battle
of Mogadishu, Libya Disarms, Cedar Revolution, Natanz Revealed and the Iraq and Syria cards compete for the same
few countries, and some of them would act on a neighbour or on the region instead. Helps the cards with a regional story (Asian Financial Crisis, Arab Spring, Eurozone Crisis, Migration
Crises), which can act on "a country in the region" without needing exact borders.

**Phone-first.** Fewer, larger badges zoomed out; with adjacency inside a region being "all of it", no lines need
drawing, which suits a small screen best. Four regions are four zoom targets.

**Engine work.** The same map schema and scenario `map` key as option A, but adjacency is simpler: a region list
plus a few crossing countries, so the content check is short. The `placementAllowed` hook still applies.

**Game length.** Shorter than option A: fewer countries means fewer placements before regions are decided, and
each turn's choices are easier to read. Swingier: one coup in a small region matters more.

## Option C: regions without adjacency, about 30 countries

- **Regions (5 or 6):** as in option A.
- **Countries:** about 5 or 6 per region, about 30 in all, about 2 battlegrounds per region.
- **No adjacency at all.** Instead of "next to your influence", the placement rule (topic 2) would be "in a region
  where you already have influence", or "anywhere, at a higher cost where the rival controls". Countries still
  belong to regions, and regions still score.

**Fit with the era files.** Helps cards whose story jumps across the world in one move (Belt and Road, Parallel
Plumbing, Olympic Summer 2008, Private Constellation, the espionage cards): no border needs to be crossed. Strains
the cards whose story is about borders and neighbours (NATO Enlargement 1999, Big Bang Enlargement 2004, Nordic
Accession, Annexation of Crimea, Full-Scale Invasion): "enlargement" reads best as spreading from neighbour to
neighbour.

**Phone-first.** No adjacency lines to draw or explain; the country list view (Decision 6) becomes as good as
the map, since position on the map carries no rule. The simplest to teach in the tutorial.

**Engine work.** The smallest map schema (country, region, stability, battleground). The placement rule moves into
topic 2's choice and the `placementAllowed` hook. No reachability check is needed.

**Game length.** Between A and B. Without adjacency, influence spreads faster, so regions are decided sooner.

## Questions for the owner

1. How many regions, and roughly how many countries? (A: 6 and about 36; B: 4 and about 24; C: 5-6 and about 30.)
2. Does adjacency matter, and if so between all neighbours (A), only inside a region (B), or not at all (C)?
3. Are the United States, Russia and China on the board as countries, or off it as home boxes?
4. Are Hong Kong, Taiwan and Crimea their own boxes? Several cards are about them; drawing them as separate
   boxes is a political choice as well as a rules one, and may matter for store review (docs/design/sides.md,
   "Not decided yet").
5. Does the map change between eras (for example Yugoslavia's break-up, the Baltic states joining Europe's
   alliances), or is it one map for 1991 to 2025 with the changes shown through influence?
