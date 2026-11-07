import { describe, expect, it } from "vitest";
import { hasTag, tagAt } from "./html.ts";

describe("hasTag and tagAt", () => {
  const html =
    '<div class="a"><section role="log" aria-label="Log" class="game-log"><ol tabindex="0" hidden></ol></section></div>';
  it("finds a tag by its attributes in any order, ignoring the others", () => {
    expect(hasTag(html, "section", { "aria-label": "Log", role: "log" })).toBe(true);
    expect(hasTag(html, "ol", { hidden: "" })).toBe(true);
    expect(tagAt(html, "section", { class: "game-log" })).toBe(html.indexOf("<section"));
  });
  it("misses a wrong value, a missing attribute or another tag name", () => {
    expect(hasTag(html, "section", { role: "list" })).toBe(false);
    expect(hasTag(html, "section", { tabindex: "0" })).toBe(false);
    expect(hasTag(html, "sect", { role: "log" })).toBe(false);
    expect(tagAt(html, "p")).toBe(-1);
  });
});
