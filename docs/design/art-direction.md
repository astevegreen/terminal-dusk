# Art direction

Decided by the owner in chat on 2026-10-28. Notes and the wider art plan: issue #478. Build tasks: #479 (the
real-geography map) and #481 (the era themes). The pipeline for card art and
audio is in `docs/workflow.md`, "Art and audio pipeline".

## The world map: real geography, the same in every era

- The map is built from free, public-domain world maps, so the world is instantly recognisable and accurate. Owner:
  "the world should be built off free public-domain world maps because that makes everything instantly recognizable
  and accurate." The picture is NASA's Blue Marble; the borders on it are Natural Earth data.
- **The look is NASA's Blue Marble** (Blue Marble: Next Generation): the satellite picture of the whole Earth, with
  real land colours and sea. Owner: "If Blue Marble Maps are public domain I like their style." That condition holds:
  NASA's imagery is US-government work, not under copyright in the US, and free to use with no licence fee under
  NASA's media guidelines, which ask for a credit.
- Blue Marble has no borders, so country borders from public-domain data (Natural Earth) are drawn on top as thin
  lines, in the same map projection so they line up with the picture.
- Each country marker sits on or near its real place. A small or crowded country can sit a little offset, joined to
  its real place by a thin leader line.
- The picture ships inside the app, scaled down to a size that loads fast on a phone. It is never fetched from NASA
  while playing. Like the SVG artwork, it is presentation data under Decision 4 (`docs/architecture.md`): it never
  goes in the scenario or the game state, and markers stay keyed by country ID.
- **Credit and limits:** the credits screen says "Blue Marble imagery: NASA Earth Observatory". No NASA logo or
  emblem anywhere, and nothing that suggests NASA made or endorses the game.
- The geography itself never changes between eras: it stays accurate and readable at phone size.
- The source, version and licence of the picture and the border data are recorded in the repo next to the files made
  from them, with how to make them again.

## Era themes: a mood for each era, on the game's furniture

Each era has its own theme, in the style of its time. Owner: "The different era styles will accent the game items
like board, frames, borders, menus, backgrounds, decks, tracks, etc." A theme is a look, not a literal picture: it
does not redraw the world map.

| Era               | Theme                 | The feel                                                                     |
| ----------------- | --------------------- | ---------------------------------------------------------------------------- |
| Era 1 (1991–2001) | Green-screen terminal | Glowing lines on black, scan lines, a blinking cursor, computer lettering    |
| Era 2 (2001–2008) | 24-hour news desk     | Deep blue, glossy panels, a red "breaking" tag, a ticker of the latest moves |
| Era 3 (2008–2025) | Data dashboard        | Charcoal, thin neon lines, a faint grid, glowing outlines, small live charts |

The optional 2025–2027 scenario extends Era 3 (`docs/design/eras.md`), so it uses Era 3's theme. A theme of its own
for those years is not chosen yet: ask the owner before building one.

What a theme styles:

- The board around the map, the map's frame, and the colour of the country borders drawn over the picture.
- Not the Blue Marble picture: it keeps its natural colours in every era. Whether a theme may dim or tint it a
  little (say, a faint green cast in Era 1) is open: ask the owner before building it.
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
  without touching the game's code. A theme needs no images of its own; the only picture is the Blue Marble map.
- **Evoke the period; copy nothing.** No real product's look, logo or trade dress, no real news channel's graphics,
  no likenesses of real people, and nothing from the original game (`docs/workflow.md`).
