import { describe, expect, it } from "vitest";
import { SIDE_NAME, SIDE_WHO, eraText, gameOverText, playsText, reasonText, sideFullName } from "./displayText.ts";

describe("the words the game screens share", () => {
  it("counts the plays this turn out of both sides' plays together, since each side makes playsPerTurn (#410)", () => {
    expect(playsText({ playsMade: 0, playsPerTurn: 1 })).toBe("Plays this turn: 0 of 2");
    expect(playsText({ playsMade: 2, playsPerTurn: 1 })).toBe("Plays this turn: 2 of 2");
    expect(playsText({ playsMade: 3, playsPerTurn: 2 })).toBe("Plays this turn: 3 of 4");
  });
  it("names the sides LIO and SAE", () => {
    expect(SIDE_NAME).toEqual({ lio: "LIO", sae: "SAE" });
  });
  it("spells out each side and says who it is, in the words of docs/design/sides.md (#414)", () => {
    expect(sideFullName("lio")).toBe("LIO (Liberal International Order)");
    expect(sideFullName("sae")).toBe("SAE (Strategic Authoritarian Entente)");
    expect(SIDE_WHO).toEqual({ lio: "The US-led bloc of real states.", sae: "Russia and China as one unified side." });
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
    expect(reasonText("trackEnd")).toBe("the score track reached its end");
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
