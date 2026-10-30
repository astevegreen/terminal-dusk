// Which era theme a game shows (#481; docs/design/art-direction.md, "Era themes").
import { describe, expect, it } from "vitest";
import { THEMES, themeFor } from "./eraTheme.ts";

describe("the era-to-theme choice", () => {
  it("gives Era 1 (1991-2001) the green-screen terminal", () => {
    expect(themeFor("era-1")).toBe("terminal");
  });
  it("gives Era 2 (2001-2008) the 24-hour news desk", () => {
    expect(themeFor("era-2")).toBe("newsDesk");
  });
  it("gives Era 3 (2008-2025) the data dashboard", () => {
    expect(themeFor("era-3")).toBe("dashboard");
  });
  it("gives the 2025-2027 future cards Era 3's theme, until the owner chooses one of their own", () => {
    expect(themeFor("future")).toBe("dashboard");
  });
  it("shows a game whose era is not known yet in Era 1's theme: every game starts in Era 1", () => {
    expect(themeFor(null)).toBe("terminal");
  });
  it("shows an era it has no row for in Era 1's theme, so a new era gets a theme only on purpose", () => {
    expect(themeFor("era-9")).toBe("terminal");
  });
  it("has one theme per era of the base game", () => {
    expect(THEMES).toEqual(["terminal", "newsDesk", "dashboard"]);
  });
});
