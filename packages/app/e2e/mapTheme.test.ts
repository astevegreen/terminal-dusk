// Guards src/game/map/mapTheme.css, drawnMap.css, regionChips.css and gameScreen.css. It sits in e2e/ because it reads files with
// Node, as server.test.ts does, and src/ is browser-only code; Vitest still runs it with the unit tests.
// The map's look is one set of settings (L3, #479): mapTheme.css gives every colour, font and line width a value,
// and the stylesheets that draw the map only read them. So an era's theme (#481) can change the whole look by
// giving those settings new values, and nothing is left behind in a fixed colour.
// The stylesheets are read from disk: Vitest hands a test an empty file for an imported stylesheet.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), "utf8");
const theme = read("../src/game/map/mapTheme.css");
const drawnMap = read("../src/game/map/drawnMap.css");
const gameScreen = read("../src/game/gameScreen.css");
const regionChips = read("../src/game/map/regionChips.css");

const withoutComments = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
const defined = new Set([...theme.matchAll(/(--map-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const used = (css: string): string[] => [...css.matchAll(/var\((--map-[a-z0-9-]+)/g)].map((m) => m[1]!);

describe("the map theme", () => {
  it("is read in full, so the checks below see the real stylesheets", () => {
    for (const css of [theme, drawnMap, gameScreen, regionChips]) expect(css.length).toBeGreaterThan(500);
  });

  it("defines every map setting that the drawn map and the List read", () => {
    const missing = [...used(drawnMap), ...used(gameScreen), ...used(regionChips)].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it("gives the world picture no filter by default: the picture as NASA made it", () => {
    expect(theme).toMatch(/--map-picture-filter:\s*none;/);
  });

  it("leaves no fixed colour in the drawn map's stylesheets", () => {
    for (const css of [drawnMap, regionChips])
      expect(withoutComments(css)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it("is the only place the side colours are set", () => {
    for (const css of [drawnMap, gameScreen, regionChips])
      expect(withoutComments(css)).not.toMatch(/--map-[a-z0-9-]+\s*:/);
  });
});
