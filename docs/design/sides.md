# Sides

Promoted on 2026-10-16 from the Decided section of the Notion page "Sides". From now on this file is the source
of truth; change it in Notion and promote again.

## The two sides

- **LIO** (Liberal International Order): the US-led bloc of real states.
- **SAE** (Strategic Authoritarian Entente): Russia and China as one unified side. One player, one pool of
  influence, and no built-in friction between the two partners.

## Asymmetry

- Both sides play by the same core rules.
- Each side has exactly **one special ability** of its own. Which ability each side gets is not decided yet.
- Beyond that, the sides differ only through the cards, the starting map and the eras.

## For the engine

- There are exactly two sides. Code should name them by a side ID (`lio` and `sae`), never by "player 1" and
  "player 2".
- Turn order between the sides is in docs/design/core-loop.md (LIO plays first; ties on opening cards go to LIO).

## Not decided yet

- LIO's special ability and SAE's special ability.
- Card wording that names real states needs care for store approval; the legal review before the first store
  submission covers it. Future-era cards name roles, not people.
