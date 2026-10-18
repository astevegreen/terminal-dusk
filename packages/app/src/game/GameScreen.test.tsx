import type { Side } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardName } from "../testMode/fixture.ts";
import { buttonsOf } from "../testMode/promptTree.ts";
import { createTestSession } from "../testMode/session.ts";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";

const frameFor = (viewer: "lio" | "sae" | "spectator"): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer(viewer);
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};
const withPublic = (frame: Frame, change: Partial<Frame["view"]["public"]>): Frame => ({
  ...frame,
  view: { ...frame.view, public: { ...frame.view.public, ...change } },
});
const props = (frame: Frame, extra: Partial<GameScreenProps> = {}): GameScreenProps => ({
  frame,
  log: [],
  era: null,
  label: cardName,
  ...extra,
});
const html = (frame: Frame, extra: Partial<GameScreenProps> = {}): string =>
  renderToString(<GameScreen {...props(frame, extra)} />);
const over = (winner: Side | null): Frame =>
  withPublic(frameFor("lio"), { status: { kind: "over", winner, reason: "turns ran out" } });

describe("GameScreen for a side", () => {
  const lio = frameFor("lio");
  const out = html(withPublic(lio, { discard: ["t1", "t2"], inPlay: ["t3"] }), { log: ["first", "second"] });
  it("shows the viewer, the turn line and the plays", () => {
    expect(out).toContain("You play LIO");
    expect(out).toContain("Turn 1 of 2");
    expect(out).toContain("Plays made: 0 of 2");
    expect(out).toContain("Your decision");
  });
  it("shows the hand by name in the frame's order and the opponent's count", () => {
    expect(out).toContain("<li>Test card 1</li><li>Test card 2</li><li>Test card 3</li>");
    expect(out).toContain("SAE holds 7 cards");
  });
  it("shows the table, with the cards in play and the discard pile", () => {
    expect(out).toContain("In play: Test card 3");
    expect(out).toContain("Discard pile: 2 cards. Last 5, newest first: Test card 2, Test card 1");
  });
  it("shows both Contingency decks with what is left and the full deck", () => {
    expect(out).toContain("LIO: 6 left: 1, 2, 3, 4, 5, 6. Deck: 1, 2, 3, 4, 5, 6");
    expect(out).toContain("SAE: 6 left: 1, 2, 3, 4, 5, 6. Deck: 1, 2, 3, 4, 5, 6");
    const used = withPublic(lio, {
      contingency: { ...lio.view.public.contingency, sae: { cards: [1, 2, 3], left: [2, 3] } },
    });
    expect(html(used)).toContain("SAE: 2 left: 2, 3. Deck: 1, 2, 3");
  });
  it("shows the log newest first from an oldest-first prop", () => {
    expect(out.indexOf("<li>second</li>")).toBeGreaterThan(-1);
    expect(out.indexOf("<li>second</li>")).toBeLessThan(out.indexOf("<li>first</li>"));
  });
  it("says it waits for the other side when no decision is waiting", () => {
    expect(html({ ...lio, decision: null })).toContain("Waiting for the other side");
  });
  it("names every region", () => {
    for (const id of ["status-bar", "map-area", "hand", "opponent", "table", "contingency", "log", "decision"]) {
      expect(out).toContain(`data-testid="${id}"`);
    }
    expect(out).toContain('<section aria-label="Your hand"');
  });
  it("shows the map box with only the not-designed text", () => {
    expect(out).toMatch(/data-testid="map-area"[^>]*><p>Map: not designed yet<\/p><\/section>/);
  });
});

describe("the discard pile", () => {
  it("shows the count of 7 and the last 5 names, newest first", () => {
    const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"];
    const out = html(withPublic(frameFor("lio"), { discard: ids }));
    const last5 = "Test card 7, Test card 6, Test card 5, Test card 4, Test card 3<";
    expect(out).toContain(`Discard pile: 7 cards. Last 5, newest first: ${last5}`);
    expect(out).not.toContain("Test card 3, Test card 2");
  });
});

describe("the era line", () => {
  it("shows the era prop", () => {
    expect(html(frameFor("lio"), { era: "late" })).toContain("Era: late");
  });
  it("says the era is not shown yet for null", () => {
    expect(html(frameFor("lio"), { era: null })).toContain("Era not shown yet");
  });
});

describe("GameScreen for a spectator", () => {
  const out = html(frameFor("spectator"), { onAnswer: () => {} });
  it("shows two hand counts, no opponent region and Game active", () => {
    expect(out).toContain("Spectating");
    expect(out).toContain("LIO holds 7 cards, SAE holds 7 cards");
    expect(out).not.toContain('data-testid="opponent"');
    expect(out).toContain("Game active");
  });
  it("shows no card ids and read-only prompts with no buttons", () => {
    expect(out).not.toMatch(/\bt\d+\b/);
    expect(out.match(/pick an opening card/g)).toHaveLength(2);
    expect(out).not.toContain("<button");
  });
});

describe("the decision region", () => {
  it("shows buttons that call onAnswer", () => {
    const answers: unknown[] = [];
    const buttons = buttonsOf(<GameScreen {...props(frameFor("lio"), { onAnswer: (v) => answers.push(v) })} />);
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]?.click();
    expect(answers).toHaveLength(1);
  });
  it("shows the refusal code when refusal is set, and nothing when it is not", () => {
    expect(html(frameFor("lio"), { refusal: "stale_seq" })).toContain("Refused: stale_seq");
    expect(html(frameFor("lio"), { refusal: null })).not.toContain("Refused");
  });
});

describe("a game that is over", () => {
  it("shows the winner and the reason", () => {
    expect(html(over("sae"))).toContain("Game over: sae, turns ran out");
  });
  it("says no winner for a tie", () => {
    expect(html(over(null))).toContain("Game over: no winner, turns ran out");
  });
});
