// The hand strip (L6, #486): each card a chip with its points, name and side; a lifted card with its full text and
// the waiting decision's choices for it; the rival's hand size and the deck and discard counts beside it.
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pointsOf } from "../displayText.ts";
import { cardAffiliation, cardName, cardQuestion, fixtureRuleset } from "../testMode/fixture.ts";
import { buttonsOf } from "../testMode/promptTree.ts";
import { createTestSession } from "../testMode/session.ts";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";
import { chipName, chipsOf } from "./handCards.tsx";
import { liftedIn, stripMove } from "./handStrip.tsx";

const frameFor = (viewer: "lio" | "sae" | "spectator"): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer(viewer);
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};
const points = pointsOf(fixtureRuleset);
const props = (frame: Frame, extra: Partial<GameScreenProps> = {}): GameScreenProps => ({
  frame,
  log: [],
  era: null,
  label: cardName,
  question: cardQuestion,
  affiliation: cardAffiliation,
  points,
  ...extra,
});
const html = (frame: Frame, extra: Partial<GameScreenProps> = {}): string =>
  renderToString(<GameScreen {...props(frame, extra)} />);
/** The strip's html: from the hand region to the sheet after it. */
const stripOf = (out: string): string =>
  out.slice(out.indexOf('data-testid="hand"'), out.indexOf('class="game-sheet"'));

describe("the chips", () => {
  const lio = frameFor("lio");
  const chips = chipsOf(lio.view.mine?.hand ?? [], cardName, points, cardAffiliation);
  it("are the hand in the frame's order, each with its points, its name and its side", () => {
    expect(chips.slice(0, 3)).toEqual([
      { card: "t1", name: "Test card 1", points: 1, side: "lio" },
      { card: "t2", name: "Test card 2", points: 2, side: "lio" },
      { card: "t3", name: "Test card 3", points: 3, side: "lio" },
    ]);
    expect(chips.find((c) => c.card === "t7")?.side).toBe("sae");
    expect(chips.find((c) => c.card === "t13")?.side).toBe("neutral");
  });
  it("show a card with unknown side as neutral and leave the points out when the game has none", () => {
    expect(chipsOf(["zz"], cardName, undefined, () => undefined)).toEqual([
      { card: "zz", name: "Test card z", points: undefined, side: "neutral" },
    ]);
  });
  it("are named for a screen reader by name, points and side, never by the bare name", () => {
    expect(chipName(chips[0]!)).toBe("Test card 1, 1 point, LIO card");
    expect(chipName({ card: "x", name: "X", points: undefined, side: "neutral" })).toBe("X, neutral card");
  });
  it("are drawn in the strip, each a button that lifts its card, none lifted at first", () => {
    const strip = stripOf(html(lio));
    expect(strip).toContain('role="toolbar" aria-label="Your cards"');
    expect(strip).toContain('aria-label="Test card 2, 2 points, LIO card" aria-expanded="false"');
    expect(strip).toContain('<span class="strip-chip-points">2</span><span class="strip-chip-name">Test card 2</span>');
    expect(strip).toContain('data-side="sae"');
    expect(strip).not.toContain('aria-expanded="true"');
  });
});

describe("the lifted cards", () => {
  const lio = frameFor("lio");
  const rules = (card: string): string | undefined => (card === "t2" ? undefined : `Rules of ${card}.`);
  it("are all hidden until a chip is tapped, each named by its card", () => {
    const strip = stripOf(html(lio, { rules }));
    const cards = [...strip.matchAll(/role="dialog" aria-label="([^"]+)"[^>]*hidden=""/g)].map((m) => m[1]);
    expect(cards.slice(0, 2)).toEqual(["Test card 1", "Test card 2"]);
    expect(cards).toHaveLength(lio.view.mine?.hand.length ?? 0);
  });
  it("show the card's full rules text when the game has it", () => {
    const strip = stripOf(html(lio, { rules }));
    expect(strip).toContain('<p class="hand-card-rules">Rules of t1.</p>');
    expect(strip).not.toContain("Rules of t2.");
  });
  it("carry the waiting decision's choices for their card, which answer it", () => {
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(<GameScreen {...props(lio, { onAnswer: (v) => sent.push(v) })} />);
    const pick = buttons.find((b) => b.text === "Test card 3");
    pick?.click();
    expect(sent).toEqual([{ kind: "chooseCard", card: "t3" }]);
  });
  it("carry no choices on a read-only screen", () => {
    expect(stripOf(html(lio))).not.toContain("lifted-choices");
    expect(stripOf(html(lio, { onAnswer: () => {} }))).toContain("lifted-choices");
  });
  it("carry a discard from the hand: tap a card to pick it", () => {
    const discard: Decision = { id: "d7", side: "lio", kind: "discardCards", options: { from: "hand", count: 1 } };
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(
      <GameScreen {...props({ ...lio, decision: discard }, { onAnswer: (v) => sent.push(v) })} />,
    );
    buttons.find((b) => b.text === "Discard Test card 2")?.click();
    expect(sent).toEqual([{ kind: "discardCards", cards: ["t2"] }]);
    const out = html({ ...lio, decision: discard }, { onAnswer: () => {} });
    expect(stripOf(out)).toContain(">Discard Test card 2</button>");
  });
});

describe("the counts beside the strip", () => {
  it("show the rival's hand size, the deck and the discard pile, never the rival's cards", () => {
    const lio = frameFor("lio");
    const out = html({ ...lio, view: { ...lio.view, public: { ...lio.view.public, discard: ["t9", "t10"] } } });
    const counts = /data-testid="strip-counts">(.*?)<\/p>/.exec(out)?.[1] ?? "";
    expect(counts).toContain(`>Rival ${lio.view.counts.hands.sae}</span>`);
    expect(counts).toContain(`>Deck ${lio.view.counts.deck}</span>`);
    expect(counts).toContain(">Discard 2</span>");
    expect(stripOf(out)).not.toMatch(/Test card (8|9|10|11|12)\b/);
  });
  it("show both hand sizes for a spectator, and no card at all", () => {
    const out = html(frameFor("spectator"), { onAnswer: () => {} });
    expect(stripOf(out)).toContain(">LIO 7</span>");
    expect(stripOf(out)).toContain(">SAE 7</span>");
    expect(stripOf(out)).not.toContain("strip-chip");
    expect(out).not.toMatch(/\bt\d+\b/);
  });
});

describe("the strip's keyboard and lift rules", () => {
  it("moves along the strip with the arrow keys, Home and End, and stops at the ends", () => {
    expect(stripMove("ArrowRight", 0, 3)).toBe(1);
    expect(stripMove("ArrowRight", 2, 3)).toBe(2);
    expect(stripMove("ArrowLeft", 0, 3)).toBe(0);
    expect(stripMove("ArrowLeft", 2, 3)).toBe(1);
    expect(stripMove("Home", 2, 3)).toBe(0);
    expect(stripMove("End", 0, 3)).toBe(2);
    expect(stripMove("Enter", 0, 3)).toBeNull();
    expect(stripMove("ArrowRight", 0, 0)).toBeNull();
  });
  it("drops the lifted card by itself once it leaves the hand", () => {
    const chips = chipsOf(["t1", "t2"], cardName, points, cardAffiliation);
    expect(liftedIn(chips, "t2")).toBe("t2");
    expect(liftedIn(chips, "t5")).toBeNull();
    expect(liftedIn(chips, null)).toBeNull();
  });
});
