// Every place a player reads an era's number also reads its name (docs/design/eras.md; owner, 26 Nov 2026: The Thaw,
// The Shock, The Fracture): the status bar in each era's theme, the log, the home screen and each game's note.
import type { Frame } from "@terminal-dusk/host";
import {
  ERA_1_FREE_NOTE,
  FIRST_DECK_NOTE,
  SCENARIO_2025_2027_NOTE,
  SIX_REGION_MAP_NOTE,
} from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, Home } from "./App.tsx";
import { eraText, mapNames } from "./displayText.ts";
import { logLine } from "./eventPresentation.ts";
import { GameScreen } from "./game/GameScreen.tsx";
import { button, treeOf } from "./online/test/screenTree.ts";
import { cardAffiliation, cardName, cardQuestion } from "./testMode/fixture.ts";
import { createTestSession } from "./testMode/session.ts";

const ERAS = [
  { id: "era-1", shown: "The Thaw (Era 1, 1991–2001)", theme: "terminal" },
  { id: "era-2", shown: "The Shock (Era 2, 2001–2008)", theme: "newsDesk" },
  { id: "era-3", shown: "The Fracture (Era 3, 2008–2025)", theme: "dashboard" },
] as const;

const frameIn = (era: string): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return { ...frame, view: { ...frame.view, public: { ...frame.view.public, era } } };
};

describe("the game screen", () => {
  for (const { id, shown, theme } of ERAS) {
    it(`shows "${shown}" in the status bar, in that era's ${theme} theme`, () => {
      const out = renderToString(
        <GameScreen
          frame={frameIn(id)}
          log={[]}
          era={id}
          label={cardName}
          question={cardQuestion}
          affiliation={cardAffiliation}
        />,
      );
      expect(out).toContain(`data-theme="${theme}"`);
      expect(out).toContain(`<span>${shown}</span>`);
    });

    it(`logs "${shown}" when that era starts`, () => {
      const names = { card: cardName, era: eraText, ...mapNames(frameIn(id).view.public) };
      const line = logLine({ kind: "eraStarted", visibility: "public", era: id, cardsAdded: 4 }, names);
      expect(line).toBe(`${shown} started: 4 cards shuffled into the draw pile.`);
    });
  }
});

describe("the home screen's free game", () => {
  it("is offered by its era's name and number, and still opens the free game", () => {
    const picked: string[] = [];
    const tree = treeOf(<Home onPick={(screen) => picked.push(screen)} />);
    button(tree, "Play the free game: The Thaw (Era 1)").press();
    expect(picked).toEqual(["vsAiFree"]);
    const out = renderToString(<App clock={() => 0} newSeed={() => "s"} newAiSeed={() => 1} />);
    expect(out).toContain("Play the free game: The Thaw (Era 1)");
  });
});

describe("the games' notes", () => {
  it("name every era they number", () => {
    expect(FIRST_DECK_NOTE).toBe(
      "First deck, the base game: 10 turns. The Thaw (Era 1) starts, The Shock (Era 2) joins on turn 4, " +
        "The Fracture (Era 3) on turn 6",
    );
    expect(ERA_1_FREE_NOTE).toBe("The free game: The Thaw (Era 1, 1991–2001) only, 3 turns");
    expect(SCENARIO_2025_2027_NOTE).toBe(
      "The 2025-2027 game: 11 turns, the future cards join on turn 11, " +
        "The Fracture (Era 3) scores once at the end of 2027",
    );
  });

  it("never show an era's number without its name in front of it", () => {
    for (const note of [FIRST_DECK_NOTE, ERA_1_FREE_NOTE, SCENARIO_2025_2027_NOTE, SIX_REGION_MAP_NOTE]) {
      // With every "Name (Era n…" taken out, no era number is left.
      expect(note.replaceAll(/The (Thaw|Shock|Fracture) \(Era \d/g, "")).not.toMatch(/Eras? \d/);
    }
  });
});
