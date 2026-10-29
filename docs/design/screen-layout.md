# Screen layout: the map is the board

Decided by the owner in chat on 2026-10-29. Build tasks: #485 to #490 (L5 to L10), then the era themes (#481, L4).
The look of the map itself is in `art-direction.md`; this file is about where everything sits on the screen.

The owner showed a screenshot of the original game's digital edition as an example of a screen that works on phones
and large monitors alike. We take **layout ideas only** from it (the map as the background, slim furniture over
it, a hand along the bottom). Nothing is copied: no names, art, text, colours or graphics.

## What the owner decided

- **The map is the background of the whole screen**, with everything else built on top of it. Owner: "The base map
  should serve as the background for the whole interface and everything should be built on top of it so it looks
  clean."
- **Phones and large screens use the same layout.** Owner: "I am open to having some differences in our game, but as
  it stands now it is extremely cramped and difficult to follow what's happening geographically."
- **The hand is a slim strip along the bottom.** Tap a card to lift it, with its play buttons on the lifted card.
- **Region standings show on the map**, as a small chip under each region's name.
- **Phones stay sideways only.** An upright phone keeps showing "Turn your phone sideways to play."
- **What just happened shows as a ticker line** under the top bar, with the full log in a drawer, and the countries
  a move touched pulse on the map.

## The problem today

Measured on a phone-sized screen (844x390, the size Decision 6 designs for):

| Part                           | Size on screen | Share of the screen                          |
| ------------------------------ | -------------- | -------------------------------------------- |
| Page note line and top bar     | 82 px tall     | a fifth of the height, before the map starts |
| Map area                       | 545x304 px     | about half                                   |
| The world drawing inside it    | 535x225 px     | **about a third**                            |
| Side panel (one tab at a time) | 287x304 px     | about a quarter, beside the map              |
| One country marker             | 25x13 px       | too small to read or tap                     |

And:

- To pick a country you press a button in the side panel that names it by its ID ("Place in ukraine"), far from
  where the country is on the map.
- What the rival just did is in a Log tab you have to open. Nothing on the map shows it.
- How each side stands in a region is not shown anywhere until the region scores.

## Principles

1. **The map is the board.** It fills the whole screen, edge to edge. Everything else floats on top of it.
2. **Furniture is slim and see-through, and gets out of the way.** Nothing permanently covers the map (Decision 6).
3. **Choose on the map.** When a decision asks for a country, the countries you may pick glow and you tap one.
4. **Show, don't make them read.** The latest move shows in one ticker line and as a pulse on the countries it
   touched. Standings show on the regions.
5. **One thing open at a time.** A lifted card, the log drawer and the details panel each close when another opens.
6. **One layout for every screen.** A large screen gets bigger cards, bigger text and room to pin the log open; it
   never gets a different board.
7. **One layout for every era.** The era themes (#481) restyle the furniture; they never move it.

## The screen, piece by piece

| Piece           | Where                                 | Phone (844x390)       | What it holds                                                                                   |
| --------------- | ------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Map             | the whole screen, behind everything   | 844x390               | the Blue Marble picture, borders, region names, country markers                                 |
| Top bar         | top edge, see-through                 | about 40 px tall      | menu, your side, turn, era, score track, Escalation, the status line ("Your move: play a card") |
| Ticker          | just under the top bar                | about 20 px tall      | the newest log line; tap to open the log drawer                                                 |
| Standings chips | on the map, under each region's name  | small                 | each side's level in that region (present, ahead, holds every battleground) and its points now  |
| Map tools       | floating, top-left corner of the map  | 44 px buttons         | Map/List, Whole map                                                                             |
| Decision banner | just above the hand strip             | one line, about 44 px | the question and any buttons that are not countries or cards                                    |
| Hand strip      | bottom edge                           | at most 56 px tall    | your cards as chips; the rival's hand size; deck and discard counts                             |
| Lifted card     | above the strip, middle of the screen | at most a third       | the card's full text and its play buttons                                                       |
| Log drawer      | slides in from the right              | about half the width  | the full log, newest first                                                                      |
| Details panel   | opened from the top bar               | about half the width  | the cards in play, the discard pile, the Contingency deck                                       |
| Credit          | bottom-right corner, small            |                       | "Blue Marble imagery: NASA Earth Observatory"                                                   |

The map fits itself into the space between the top bar and the hand strip, so "Whole map" shows every country; the
picture runs on under the see-through bars to the screen's edges.

### A phone, your turn, nothing open

```
+------------------------------------------------------------------------------------+
| =  LIO  Turn 3/10  Era 1 | Score [====|==  ] LIO +2 | Escalation 4 | Your move     |  top bar
| > SAE placed 2 in Ukraine                                                          |  ticker
|                                                                                    |
|  [Whole map]                  EUROPE                                               |
|  [List]                    [LIO ahead 5 | SAE present 1]           ASIA            |
|                          (Pol)(Ukr)(Bel)                       [LIO - | SAE - ]    |
|   AMERICAS                    (Crimea)                    (Kaz)                    |
|   [ - | - ]           MIDDLE EAST                                  (Taiwan)        |
|                       [ - | SAE present 1]                                         |
|                 the Blue Marble picture fills the screen, edge to edge             |
|                                                                                    |
| [3 Card][2 Card][4 Card][1 Card][3 Card][2 Card][4 Card]    Rival 7   Deck 23     |  hand strip
+------------------------------------------------------------------------------------+
```

### Tap a card: it lifts, with its buttons

```
| ...                                                                                |
|                        +--------------------------------+                          |
|                        | 3   Card name                  |                          |
|                        |     The card's text, in full.  |                          |
|                        | [ Event ]  [ Points ]          |                          |
|                        +--------------------------------+                          |
| [3 Card][2 Card][ ^^^^ ][1 Card][3 Card][2 Card][4 Card]    Rival 7   Deck 23     |
+------------------------------------------------------------------------------------+
```

### Choose a country: the choices glow on the map

```
|                              EUROPE                                                |
|                          ((Pol))((Ukr)) (Bel)      <- glowing: you may pick these |
|                              (Crimea)              <- dim: you may not            |
| LIO: place 1 influence (3 points left) - tap a glowing country                    |  decision banner
| [3 Card][2 Card][4 Card][1 Card][3 Card][2 Card]            Rival 7   Deck 23     |
+------------------------------------------------------------------------------------+
```

### A large screen (1280x800 and up)

The same pieces with more room: the hand strip shows bigger cards with their names in full, text is larger, and the
log drawer can be pinned open on the right without covering the middle of the map.

```
+--------------------------------------------------------------------------------------------+
| =  LIO  Turn 3/10  Era 1 |  Score [=======|====      ] LIO +2  |  Escalation 4  | Your move  |
| > SAE placed 2 in Ukraine                                                                  |
|                                                                        +-----------------+ |
|                                                                        | Log (pinned)    | |
|            the map, much bigger, every marker readable                 | SAE placed 2 in | |
|                                                                        | Ukraine         | |
|                                                                        | ...             | |
|                                                                        +-----------------+ |
| +--------+ +--------+ +--------+ +--------+ +--------+ +--------+            Rival 7       |
| | 3 Card | | 2 Card | | 4 Card | | 1 Card | | 3 Card | | 2 Card |            Deck 23       |
| +--------+ +--------+ +--------+ +--------+ +--------+ +--------+                          |
+--------------------------------------------------------------------------------------------+
```

## A turn, start to finish

1. The rival moves. The ticker says "SAE placed 2 in Ukraine", Ukraine's marker pulses, and Europe's standings chip
   changes.
2. Your turn. The status line says "Your move: play a card" and the hand strip lights up.
3. You tap a card. It lifts, showing its text and the buttons Event and Points.
4. You tap Points. The banner asks "LIO: place 1 influence (3 points left)". The countries you may place in glow on
   the map.
5. You tap Poland, then Ukraine twice. Each tap answers one decision; the marker's numbers and the chip update as you
   go. On a phone, a tap on a small country first zooms into its region so every target is at least 44 px (#487
   settles exactly how).
6. The banner goes away, the ticker shows your last move, and the rival's turn begins.

## What stays the same

- The rules, the frames and the decisions. All of this is presentation: nothing goes in the engine, the scenario or
  the game state.
- Decision 6: designed for 844x390 landscape first; one prompt component per decision kind; animation from events,
  never from comparing states; pan and zoom move one wrapper with CSS transforms outside React renders; the List view
  stays as an alternative to the map.
- Tap targets of at least 44 px, keyboard play, and screen-reader names for every piece.
- vs AI, online play, watching, Test mode and the replay all use the same screen.
- LIO blue and SAE red, in every era.

## Build order

| Step | Issue | What it does                                                                                    | Needs       |
| ---- | ----- | ----------------------------------------------------------------------------------------------- | ----------- |
| L5   | #485  | The map fills the screen; a see-through top bar; today's tabs move into a sheet that folds down | #479 merged |
| L6   | #486  | The hand strip along the bottom, and the lifted card with its play buttons                      | L5          |
| L7   | #487  | Choose countries by tapping them on the map; country names, never IDs                           | L5          |
| L8   | #488  | Region standings chips on the map                                                               | L5          |
| L9   | #489  | The ticker, the log drawer, and touched countries pulse                                         | L5          |
| L10  | #490  | The details panel, the sheet removed, and large screens                                         | L5 to L9    |
| L4   | #481  | Era themes, styling all of the furniture above                                                  | L5 to L10   |

L5 comes first because every other step builds on its frame. L6 to L9 each touch a different piece and can be built
one after another in any order. The era themes come last so they style the new furniture rather than the old.

## Later, not in these steps

- **Staged answers with undo.** Decision 6 lets a player place all their influence with free undo and confirm once.
  Today each placement is its own decision. Building that changes how answers are sent, so it needs the `architect`
  agent first, and its own task.
- **Card art** on the lifted card and in the strip, from the art pipeline in `docs/workflow.md`.
