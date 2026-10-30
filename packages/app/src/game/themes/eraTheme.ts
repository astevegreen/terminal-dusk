// The era themes (#481; docs/design/art-direction.md, "Era themes"): one look per era, chosen by the era the game
// shows. Each theme is a stylesheet in this folder that gives the map's and the furniture's settings new values; the
// game's root carries the chosen one as `data-theme`. Presentation only: nothing here reaches the rules or the state.
import type { EraId } from "@terminal-dusk/engine";
import "./terminal.css";
import "./newsDesk.css";
import "./dashboard.css";

/** The themes, in era order: green-screen terminal, 24-hour news desk, data dashboard. */
export const THEMES = ["terminal", "newsDesk", "dashboard"] as const;
export type ThemeName = (typeof THEMES)[number];

/** The theme of each era that has one. The future cards (2025-2027) extend Era 3, so they share its theme until the
 *  owner chooses one of their own. */
const BY_ERA: Readonly<Record<string, ThemeName>> = {
  "era-1": "terminal",
  "era-2": "newsDesk",
  "era-3": "dashboard",
  future: "dashboard",
};

/** The theme for `era`. A game starts in Era 1, so an era not known yet, or one with no row above, shows Era 1's. */
export const themeFor = (era: EraId | null): ThemeName =>
  era !== null && Object.hasOwn(BY_ERA, era) ? BY_ERA[era]! : "terminal";
