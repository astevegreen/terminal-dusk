# Art direction

Decided by the owner in chat on 2026-10-28. Notes and the wider art plan: issue #478. Build tasks: #479 (the
real-geography map) and #481 (the era themes). The pipeline for card art and
audio is in `docs/workflow.md`, "Art and audio pipeline".

## The world map: real geography, the same in every era

- The map is built from free, public-domain world map data, such as Natural Earth, so the world is instantly
  recognisable and accurate. Owner: "the world should be built off free public-domain world maps because that makes
  everything instantly recognizable and accurate."
- Coastlines and countries are drawn from that data. Each country marker sits on or near its real place. A small or
  crowded country can sit a little offset, joined to its real place by a thin leader line.
- The geography itself never changes between eras: it stays clean, accurate and readable at phone size.
- The data's source and licence are recorded in the repo next to the drawing made from it.

## Era themes: a mood for each era, on the game's furniture

Each era has its own theme, in the style of its time. Owner: "The different era styles will accent the game items
like board, frames, borders, menus, backgrounds, decks, tracks, etc." A theme is a look, not a literal picture: it
does not redraw the world map.

| Era                    | Theme                 | The feel                                                                     |
| ---------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Era 1 (1991–2001)      | Green-screen terminal | Glowing lines on black, scan lines, a blinking cursor, computer lettering    |
| Era 2 (2001–2008)      | 24-hour news desk     | Deep blue, glossy panels, a red "breaking" tag, a ticker of the latest moves |
| Era 3 (2008–2025)      | Data dashboard        | Charcoal, thin neon lines, a faint grid, glowing outlines, small live charts |
| Future era (2025–2027) | Not chosen yet        | Ask the owner before building it                                             |

What a theme styles:

- The board around the map and the map's frame, and the sea and background tint behind the land.
- Frames and borders: card frames, panels, the side panel's tabs, and the frames of the country markers.
- Menus, buttons, backgrounds and lettering.
- The decks, the score track, the Escalation track and the other tracks, and the status bar and log.

Rules for every theme:

- **One theme at a time, chosen by the era the game shows.** The theme changes when a new era starts. Any change
  animation is driven by the era-start event, never by comparing two states (`.claude/rules/app.md`).
- **Same layout in every era.** Only colours, lettering, textures and frames change, so players never relearn the
  screen.
- **LIO stays blue and SAE stays red in every era**, restyled but always easy to tell apart. Numbers stay readable at
  844x390, and tap targets stay at least 44 px.
- **Built in code:** each theme is one set of CSS variables plus SVG and CSS styling, so a theme can be adjusted
  without touching the game's code. No images are needed for a theme.
- **Evoke the period; copy nothing.** No real product's look, logo or trade dress, no real news channel's graphics,
  no likenesses of real people, and nothing from the original game (`docs/workflow.md`).
