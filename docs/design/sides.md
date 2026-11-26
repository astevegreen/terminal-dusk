# Sides

Promoted on 2026-10-16 from the Decided section of the Notion page "Sides". From now on this file is the source
of truth; change it in Notion and promote again. The special abilities were decided on 2026-11-21 (owner, in chat:
"Take all recommendations"; docs/proposals/special-abilities.md).

## The two sides

- **LIO** (Liberal International Order): the US-led bloc of real states.
- **SAE** (Strategic Authoritarian Entente): Russia and China as one unified side. One player, one pool of
  influence, and no built-in friction between the two partners.

## Asymmetry

- Both sides play by the same core rules.
- Each side has exactly **one special ability** of its own (owner, 21 Nov 2026):
  - **LIO: Resilient institutions.** The first time in a turn that a draw from LIO's own Contingency deck shows a 1,
    that card is set aside and LIO draws again. In a card's event it follows whose card play it is (owner,
    26 Nov 2026; docs/design/contingency-deck.md, "Whose bonuses apply"): it works on a draw made for LIO in the event
    of a card LIO played, from LIO's own deck or the World deck standing in for it, and on no draw in the event of
    a card SAE played, even one from LIO's own deck. A draw from SAE's deck is made for SAE, even in a card LIO
    played (for example one that settles SAE's choice, as in e1-lio-004), so it never redraws; and when an event
    makes both sides draw, only LIO's draw can (owner, 26 Nov 2026, in chat: "LIO's own draw only"; "No redraw"). Draws outside card events (interventions, realignments, the tech race)
    are unchanged: LIO's own deck only. It does not apply to a crisis draw (where a 1 is LIO's best
    result), and a crisis draw does not use up the once-per-turn redraw (owner, 21 Nov 2026, in chat: "Take all").
  - **SAE: Unified command.** After SAE plays one of its own cards for its event, the next card SAE plays for its
    action points in the same turn counts 1 more. Only card plays after the opening cards count: an SAE opening
    card does not set it up (owner, 21 Nov 2026, in chat).
  - The numbers in them (SAE's 1 more, LIO's once per turn) stand for now (owner, 26 Nov 2026, in chat). They are
    reviewed once a Medium-against-Medium balance run shows whether either ability tips the game.
- Both abilities are automatic: the player never chooses to use them. They are deliberately different in kind.
- Both players can always see each side's ability, and whether it was used this turn.
- The abilities are "fixed per scenario" (owner): the same two in every scenario for now. The scenario data names
  them, so a later scenario can change them (owner, 21 Nov 2026, in chat).
- Beyond that, the sides differ only through the cards, the starting map and the eras.

## For the engine

- There are exactly two sides. Code should name them by a side ID (`lio` and `sae`), never by "player 1" and
  "player 2".
- Turn order between the sides is in docs/design/core-loop.md (LIO plays first; ties on opening cards go to LIO).

## Not decided yet

- Card wording that names real states needs care for store approval; the legal review before the first store
  submission covers it. Future-era cards name roles, not people.
