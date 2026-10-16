---
paths:
  - "packages/app/**"
  - "shells/**"
---
# App and shell rules
- The UI renders frames and sends answers. No rules logic, no GameState import.
- Each DecisionKind has one prompt component; each EventKind has one presentation entry. Keep both maps exhaustive.
- Animation and sound are driven by events, never by comparing two states.
- Design for 844x390 landscape first, then scale up. Tap targets at least 44 px.
- Map pan and zoom move one wrapper with CSS transforms, outside React renders.
- Platform differences go through the Platform interface. No `if (iOS)` checks anywhere else.
- Shells load the bundled build, never a URL. Electron keeps context isolation on.
- New screens get a Playwright smoke test at phone and desktop sizes.
