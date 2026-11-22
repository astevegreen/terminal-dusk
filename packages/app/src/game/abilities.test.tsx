// The sides' special abilities on screen (#602): both sides' abilities, their numbers and this turn's use, from the
// frame's public state, in the Details panel; nothing for a game whose setup names none. Plus their log lines.
import type { GameEvent, PublicState } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameNames } from "../displayText.ts";
import { logLine } from "../eventPresentation.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import { GameScreen } from "./GameScreen.tsx";
import { Abilities, abilityText } from "./abilities.tsx";

const base = (): PublicState => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame.view.public;
};
const withAbilities = (ready: boolean, used: number, lioUsed = 0): PublicState => ({
  ...base(),
  abilities: {
    lio: { id: "resilientInstitutions", perTurn: 1, used: lioUsed },
    sae: { id: "unifiedCommand", bonus: 1, ready, used },
  },
});
const unescape = (s: string) => s.replaceAll("&#x27;", "'");

describe("the special abilities panel", () => {
  it("names both sides' abilities and their numbers, one short line each", () => {
    const out = unescape(renderToString(<Abilities pub={withAbilities(false, 0)} />));
    expect(out).toContain('aria-label="Special abilities"');
    expect(out).toContain("LIO Resilient institutions: redraw a 1, used 0 of 1");
    expect(out).toContain("SAE Unified command: +1 after an event, not used");
  });

  it("shows whether each was used, or is ready, this turn", () => {
    const out = renderToString(<Abilities pub={withAbilities(true, 0, 1)} />);
    expect(out).toContain("redraw a 1, used 1 of 1");
    expect(out).toContain("after an event, ready now");
    expect(renderToString(<Abilities pub={withAbilities(false, 1)} />)).toContain("after an event, used this turn");
  });

  it("shows the scenario's numbers, not fixed ones", () => {
    expect(abilityText({ id: "resilientInstitutions", perTurn: 2, used: 2 })).toBe(
      "Resilient institutions: redraw a 1, used 2 of 2",
    );
    expect(abilityText({ id: "unifiedCommand", bonus: 3, ready: false, used: 0 })).toBe(
      "Unified command: +3 after an event, not used",
    );
  });

  it("is in the game screen's Details panel, for a player and a spectator alike", () => {
    for (const viewer of ["lio", "spectator"] as const) {
      const session = createTestSession(() => 0);
      session.setViewer(viewer);
      const frame = session.getSnapshot().frame!;
      const abilities = withAbilities(true, 0).abilities!;
      const out = renderToString(
        <GameScreen
          frame={{ ...frame, view: { ...frame.view, public: { ...frame.view.public, abilities } } }}
          log={[]}
          era={null}
          label={cardName}
          question={cardQuestion}
          affiliation={cardAffiliation}
        />,
      );
      const panel = /<div[^>]*class="game-drawer game-details"[^]*?(?=<section aria-label="Map")/.exec(out)?.[0] ?? "";
      expect(panel).toContain('data-testid="abilities"');
      expect(panel).toContain("ready now");
    }
  });

  it("shows nothing when the setup names no abilities", () => {
    const pub = base();
    expect(pub.abilities).toBeUndefined();
    expect(renderToString(<Abilities pub={pub} />)).toBe("");
  });
});

describe("the abilities' log lines", () => {
  const line = (event: GameEvent): string => logLine(event, {} as GameNames);
  it.each([
    [
      { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "lio", setAside: 1 },
      "LIO's Resilient institutions set the 1 aside and drew again from the LIO Contingency deck.",
    ],
    [
      { kind: "abilityReady", visibility: "public", side: "sae" },
      "SAE's Unified command is ready: its next card played for points this turn counts more.",
    ],
    [{ kind: "abilityBonus", visibility: "public", side: "sae", amount: 1 }, "SAE's Unified command adds 1 point."],
    [{ kind: "abilityBonus", visibility: "public", side: "sae", amount: 2 }, "SAE's Unified command adds 2 points."],
  ] as [GameEvent, string][])("%o reads as it should", (event, text) => {
    expect(line(event)).toBe(text);
  });
});
