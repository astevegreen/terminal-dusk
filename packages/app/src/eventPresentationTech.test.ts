import type { GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import type { GameNames } from "./displayText.ts";
import { logLine } from "./eventPresentation.ts";
import { testCountryName } from "./test/promptProps.ts";

// Log lines for the tech race powers (R26, #476).
const NAMES: GameNames = {
  card: (id) => id,
  era: (era) => era,
  region: (id) => id,
  country: testCountryName,
};
const say = (event: GameEvent): string => logLine(event, NAMES);

describe("eventPresentation: tech powers", () => {
  it("adds + 1 tech to a realignment line when the holder's Networks and Orbit applied (R26)", () => {
    const line = say({
      kind: "realigned",
      visibility: "public",
      side: "lio",
      country: "delta",
      totals: { lio: 6, sae: 4 },
      loser: "sae",
      removed: 2,
      tech: 1,
    });
    expect(line).toBe("LIO realigned in Delta: LIO 6 (incl. + 1 tech), SAE 4. SAE lost 2 influence.");
  });
  it("adds + 1 tech to an SAE realignment line on SAE's own total", () => {
    const line = say({
      kind: "realigned",
      visibility: "public",
      side: "sae",
      country: "charlie",
      totals: { lio: 4, sae: 4 },
      loser: null,
      removed: 0,
      tech: 1,
    });
    expect(line).toBe("SAE realigned in Charlie: LIO 4, SAE 4 (incl. + 1 tech). A tie: nothing changed.");
  });
  it("adds + 1 tech to an intervention line when the holder's AI power applied (R26)", () => {
    const base = { kind: "intervened", visibility: "public", side: "lio", country: "echo", stability: 1 } as const;
    expect(say({ ...base, points: 2, draw: 4, result: 5, removed: 3, added: 2, tech: 1 })).toBe(
      "LIO intervened in Echo: draw 4 + 2 points - 2 x stability 1 + 1 tech = 5; removed 3 rival influence, added 2 own.",
    );
  });
});
