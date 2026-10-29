// Guards the furniture's stylesheets (L10, #490): the top bar with its score track, the log drawer and the Details
// panel. It sits in e2e/ because it reads files with Node, as mapTheme.test.ts does; Vitest runs it with the unit
// tests. Every colour and size of the furniture is a setting on .game, so an era's theme (#481) restyles it by giving
// those settings new values: these stylesheets only read them, and leave no fixed colour behind (the score track's
// colours were the last ones, moved into settings by L10).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string): string => readFileSync(new URL(`../src/game/${name}`, import.meta.url), "utf8");
const withoutComments = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//g, "");

/** The stylesheets that only read the furniture's settings. */
const readers = { "gameBars.css": read("gameBars.css"), "logDrawer.css": read("logDrawer.css") };
/** The stylesheets that set them, on .game. */
const setters = [read("gameScreen.css"), read("handStrip.css"), read("decisionBanner.css")].map(withoutComments);

const SETTING = /(--(?:game|track|strip|lifted)-[a-z0-9-]+)/;
const defined = new Set(
  setters.flatMap((css) => [...css.matchAll(new RegExp(`${SETTING.source}\\s*:`, "g"))].map((m) => m[1])),
);
const used = (css: string): string[] => [...css.matchAll(new RegExp(`var\\(${SETTING.source}`, "g"))].map((m) => m[1]!);

describe("the furniture's settings", () => {
  it("are read in full, so the checks below see the real stylesheets", () => {
    for (const css of [...Object.values(readers), ...setters]) expect(css.length).toBeGreaterThan(500);
  });

  it("leave no fixed colour in the top bar, the score track, the log drawer or the Details panel", () => {
    for (const [name, css] of Object.entries(readers))
      expect(withoutComments(css), name).not.toMatch(
        /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(?:black|white)(?![-\w])/i,
      );
  });

  it("are each given a value on .game before they are read", () => {
    const missing = Object.values(readers)
      .flatMap(used)
      .filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it("give the score track its colours as settings an era's theme can change", () => {
    for (const name of ["--track-bg", "--track-middle", "--track-marker", "--track-marker-edge"]) {
      expect(defined.has(name), name).toBe(true);
      expect(used(readers["gameBars.css"]), name).toContain(name);
    }
  });
});
