import { describe, expect, it } from "vitest";
import { SIDE_NAME, eraText, gameOverText, reasonText } from "./displayText.ts";

describe("the words the game screens share", () => {
  it("names the sides LIO and SAE", () => {
    expect(SIDE_NAME).toEqual({ lio: "LIO", sae: "SAE" });
  });
  it("names each first-deck era by its number and years, and the future cards by theirs (docs/design/eras.md)", () => {
    expect(eraText("era-1")).toBe("Era 1 (1991–2001)");
    expect(eraText("era-2")).toBe("Era 2 (2001–2008)");
    expect(eraText("era-3")).toBe("Era 3 (2008–2025)");
    expect(eraText("future")).toBe("Future cards (2025–2027)");
  });
  it("shows an era id it has no text for as it is", () => {
    expect(eraText("test")).toBe("test");
  });
  it("says why a game ended in words, for each reason the engine gives", () => {
    expect(reasonText("turnLimitReached")).toBe("the last turn ended");
    expect(reasonText("resigned")).toBe("the other side resigned");
    expect(reasonText("timeout")).toBe("time ran out");
  });
  it("shows a reason it has no words for as it is, even one named like an object property", () => {
    expect(reasonText("scored")).toBe("scored");
    expect(reasonText("constructor")).toBe("constructor");
  });
  it("names the winner as LIO or SAE, or no winner, before the reason", () => {
    expect(gameOverText({ kind: "over", winner: "lio", reason: "resigned" })).toBe(
      "Game over: LIO, the other side resigned",
    );
    expect(gameOverText({ kind: "over", winner: null, reason: "turnLimitReached" })).toBe(
      "Game over: no winner, the last turn ended",
    );
  });
});
