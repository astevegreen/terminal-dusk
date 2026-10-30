// Guards the era themes (#481; docs/design/art-direction.md, "Era themes"): src/game/themes/*.css. It sits in e2e/
// because it reads files with Node, as mapTheme.test.ts does; Vitest runs it with the unit tests (an imported
// stylesheet reaches a test as an empty file).
//
// A theme gives the existing settings new values: every colour, font, filter and shadow of the map (mapTheme.css)
// and of the furniture (gameScreen.css, handStrip.css, decisionBanner.css). It never sets a size, so the layout is
// the same in every era, and it adds no image.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "../src/game/themes/eraTheme.ts";

const read = (name: string): string => readFileSync(new URL(`../src/game/${name}`, import.meta.url), "utf8");
const withoutComments = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//g, "");

/** Each setting a stylesheet gives a value, with the first value it gives. */
const settingsOf = (css: string): Map<string, string> => {
  const found = new Map<string, string>();
  for (const m of withoutComments(css).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
    if (!found.has(m[1]!)) found.set(m[1]!, m[2]!.trim());
  return found;
};

const base = new Map([
  ...settingsOf(read("map/mapTheme.css")),
  ...[...settingsOf(read("gameScreen.css") + read("handStrip.css") + read("decisionBanner.css"))].filter(([name]) =>
    /^--(?:game|track|strip|lifted)-/.test(name),
  ),
]);

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
/** A setting of the look: its value is a colour, or it is a font, a filter or a shadow. */
const isLook = (name: string, value: string): boolean => COLOUR.test(value) || /-font$|filter|shadow/.test(name);
/** A setting of the layout: a size, which a theme must leave alone. */
const isSize = (name: string, value: string): boolean =>
  !isLook(name, value) && /\d(?:px|r?em|%|vw|vh|dvh)\b|clamp\(|min\(|max\(/.test(value);

const look = [...base].filter(([name, value]) => isLook(name, value)).map(([name]) => name);
const sizes = [...base].filter(([name, value]) => isSize(name, value)).map(([name]) => name);
const themes = THEMES.map((name) => ({ name, css: read(`themes/${name}.css`) }));
const settingsOfTheme = (name: string): Map<string, string> => settingsOf(themes.find((t) => t.name === name)!.css);

/** WCAG 2's relative luminance of a #rrggbb colour. */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/** A #rrggbb colour's hue, 0 to 360. */
const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r!, g!, b!);
  const d = max - Math.min(r!, g!, b!);
  if (d === 0) return 0;
  const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return (h * 60 + 360) % 360;
};
const hex = (theme: Map<string, string>, name: string): string => {
  const value = theme.get(name) ?? "";
  expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
  return value;
};

describe("the era themes", () => {
  it("are read in full, so the checks below see the real stylesheets", () => {
    for (const { css } of themes) expect(css.length).toBeGreaterThan(500);
    expect(look.length).toBeGreaterThan(50);
    expect(sizes).toContain("--game-strip-h");
  });

  it("each give every colour, font, filter and shadow setting a value", () => {
    for (const { name, css } of themes) {
      const set = settingsOf(css);
      expect(
        look.filter((setting) => !set.has(setting)),
        name,
      ).toEqual([]);
    }
  });

  it("each set no size, so the layout is the same in every era", () => {
    for (const { name, css } of themes) {
      const set = settingsOf(css);
      expect(
        sizes.filter((setting) => set.has(setting)),
        name,
      ).toEqual([]);
    }
  });

  it("each set only settings the game has, so a misspelt name cannot pass silently", () => {
    for (const { name, css } of themes)
      expect(
        [...settingsOf(css).keys()].filter((setting) => !base.has(setting)),
        name,
      ).toEqual([]);
  });

  it("each style the game's root, and the replay's, only when that theme is chosen", () => {
    for (const { name, css } of themes)
      expect(withoutComments(css), name).toContain(`:is(.game, .replay)[data-theme="${name}"] {`);
  });

  it("add no image: the only picture is the world map", () => {
    for (const { name, css } of themes) expect(withoutComments(css), name).not.toMatch(/url\(/);
  });

  it("stop every moving decoration when the player asks for reduced motion", () => {
    for (const { name, css } of themes) {
      const plain = withoutComments(css);
      if (/animation\s*:/.test(plain)) expect(plain, name).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    }
  });

  it("keep LIO blue and SAE red in every era", () => {
    for (const { name } of themes) {
      const theme = settingsOfTheme(name);
      const lio = hue(hex(theme, "--map-lio"));
      const sae = hue(hex(theme, "--map-sae"));
      expect(lio >= 190 && lio <= 250, `${name} LIO hue ${lio}`).toBe(true);
      expect(sae >= 345 || sae <= 15, `${name} SAE hue ${sae}`).toBe(true);
    }
  });

  it("keep the marker text readable on LIO, SAE and an uncontrolled country (contrast 4.5:1 or more)", () => {
    for (const { name } of themes) {
      const theme = settingsOfTheme(name);
      const text = hex(theme, "--map-marker-text");
      for (const side of ["--map-lio", "--map-sae", "--map-none"])
        expect(contrast(hex(theme, side), text), `${name} ${side}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keep LIO's and SAE's numbers readable on the home boxes and the influence badges (4.5:1 or more)", () => {
    for (const { name } of themes) {
      const theme = settingsOfTheme(name);
      for (const fill of ["--map-home-fill", "--map-badge-fill"])
        for (const side of ["--map-lio", "--map-sae"])
          expect(contrast(hex(theme, side), hex(theme, fill)), `${name} ${side} on ${fill}`).toBeGreaterThanOrEqual(
            4.5,
          );
    }
  });

  it("keep the game's lettering readable on its background (4.5:1 or more)", () => {
    for (const { name } of themes) {
      const theme = settingsOfTheme(name);
      expect(contrast(hex(theme, "--game-fg"), hex(theme, "--game-bg")), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keep the top bar see-through, so the map runs on under it", () => {
    for (const { name } of themes) {
      const bar = settingsOfTheme(name).get("--game-bar-bg") ?? "";
      const alphas = [...bar.matchAll(/rgba?\([^)]*\/\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
      expect(alphas.length, name).toBeGreaterThan(0);
      for (const alpha of alphas) expect(alpha, name).toBeLessThan(1);
    }
  });
});
