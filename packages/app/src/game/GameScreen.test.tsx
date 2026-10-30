import type { Side } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
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
  question: cardQuestion,
  affiliation: cardAffiliation,
  ...extra,
});
const html = (frame: Frame, extra: Partial<GameScreenProps> = {}): string =>
  renderToString(<GameScreen {...props(frame, extra)} />);
const over = (winner: Side | null, reason = "turns ran out"): Frame =>
  withPublic(frameFor("lio"), { status: { kind: "over", winner, reason } });

/**
 * The Decision region's html, up to the bottom edge after it (the banner sits just above the hand strip since L7,
 * #487). The frames are on the test map (issue #366), whose region buttons (zoom, for every viewer) are elsewhere on
 * the screen, so button checks look here.
 */
const decisionOf = (out: string): string => {
  const start = out.indexOf('data-testid="decision"');
  const end = out.indexOf('<div class="game-bottom"', start);
  if (start < 0 || end < 0) throw new Error("no Decision region");
  return out.slice(start, end);
};

/** Every text must appear in the page. */
const expectAll = (out: string, texts: string[]): void => {
  for (const text of texts) expect(out).toContain(text);
};

describe("GameScreen for a side", () => {
  const lio = frameFor("lio");
  const out = html(withPublic(lio, { discard: ["t1", "t2"], inPlay: ["t3"] }), { log: ["first", "second"] });
  it("shows the viewer, the turn line and the plays", () => {
    expectAll(out, ["You play LIO", "Turn 1 of 2", "Plays this turn: 0 of 4", "Your decision"]);
  });
  it("shows the hand in the strip by name in the frame's order, and the opponent's count", () => {
    const names = [...out.matchAll(/<span class="strip-chip-name">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(names.slice(0, 3)).toEqual(["Test card 1", "Test card 2", "Test card 3"]);
    expect(out).toContain("SAE holds 7 cards");
  });
  it("shows each card's rules text under its name on the lifted card when the game has rules text (#414)", () => {
    const rules = (card: string): string | undefined => (card === "t2" ? undefined : `Rules of ${card}.`);
    const withRules = html(lio, { rules });
    expectAll(withRules, [
      '<span class="hand-card-name">Test card 1</span><span class="lifted-side">LIO card</span></p><p class="hand-card-rules">Rules of t1.</p>',
      '<span class="hand-card-name">Test card 2</span><span class="lifted-side">LIO card</span></p></div>',
      '<span class="hand-card-name">Test card 3</span><span class="lifted-side">LIO card</span></p><p class="hand-card-rules">Rules of t3.</p>',
    ]);
  });
  it("shows the table, with the cards in play and the discard pile", () => {
    expectAll(out, ["In play: Test card 3", "Discard pile: 2 cards. Last 5, newest first: Test card 2, Test card 1"]);
  });
  it("shows all three Contingency decks, the World deck included, with what is left and the full deck", () => {
    expectAll(out, [
      "LIO: 6 left: 1, 2, 3, 4, 5, 6. Deck: 1, 2, 3, 4, 5, 6",
      "SAE: 6 left: 1, 2, 3, 4, 5, 6. Deck: 1, 2, 3, 4, 5, 6",
      "World: 6 left: 1, 2, 3, 4, 5, 6. Deck: 1, 2, 3, 4, 5, 6",
    ]);
    const used = withPublic(lio, {
      contingency: {
        ...lio.view.public.contingency,
        sae: { cards: [1, 2, 3], left: [2, 3] },
        world: { cards: [1, 2, 3, 4], left: [1, 4] },
      },
    });
    expectAll(html(used), ["SAE: 2 left: 2, 3. Deck: 1, 2, 3", "World: 2 left: 1, 4. Deck: 1, 2, 3, 4"]);
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
  it("shows the Map area (MapView.test.tsx covers its badges)", () => {
    expect(out).toContain('data-testid="map-area"');
    expect(out).not.toContain("Map: not designed yet");
  });
});

describe("the top bar (L5, #485)", () => {
  const lio = frameFor("lio");
  it("holds the page's Menu, then the page's own items, then the status and the tracks", () => {
    const out = html(lio, { menu: <p>A note</p>, bar: <button type="button">Back</button> });
    expect(out).toContain(
      '<div class="game-top"><details class="game-menu"><summary>Menu</summary><div class="game-menu-body"><p>A note</p></div></details><button type="button">Back</button><div class="game-top-main"><section aria-label="Status" data-testid="status-bar"',
    );
    expect(out.indexOf('data-testid="tracks"')).toBeGreaterThan(out.indexOf('data-testid="status-bar"'));
    expect(out.indexOf('data-testid="tracks"')).toBeLessThan(out.indexOf('data-testid="map-area"'));
  });
  it("has no Menu when the page gives it nothing to hold", () => {
    const out = html(lio);
    expect(out).not.toContain("<details");
    expect(out).toContain('<div class="game-top"><div class="game-top-main"><section aria-label="Status"');
  });
});

describe("the ticker and the log drawer (L9, #489)", () => {
  const out = html(frameFor("lio"), { log: ["first", "second"] });
  it("puts the ticker at the top bar's right end, after the tracks, showing the newest log line", () => {
    const top = /<div class="game-top">[^]*?<\/button><\/div>/.exec(out)?.[0] ?? "";
    expect(top).toMatch(/data-testid="tracks"[^]*data-testid="ticker"[^]*<\/button><\/div>$/);
    expect(top).toContain('<span class="game-ticker-line">second</span>');
    expect(out.indexOf('data-testid="ticker"')).toBeLessThan(out.indexOf('data-testid="map-area"'));
  });
  it("keeps the log in the drawer the ticker opens, and the sheet and its tabs are gone (L10, #490)", () => {
    const drawer = out.indexOf('class="game-drawer"');
    expect(out.indexOf('data-testid="log"')).toBeGreaterThan(drawer);
    expect(out.indexOf('data-testid="log"')).toBeLessThan(out.indexOf('data-testid="map-area"'));
    expect(out).not.toContain('role="tab"');
    expect(out).not.toContain("game-sheet");
  });
});

describe("the Details panel (L10, #490)", () => {
  const out = html(frameFor("lio"), { log: ["first"] });
  const panel = /<div[^>]*class="game-drawer game-details"[^]*?(?=<section aria-label="Map")/.exec(out)?.[0] ?? "";
  it("is opened from a Details button in the top bar, before the ticker", () => {
    const top = /<div class="game-top">[^]*?<\/button><\/div>/.exec(out)?.[0] ?? "";
    expect(top).toMatch(
      /data-testid="tracks"[^]*class="game-details-button"[^>]*>Details<\/button><button[^>]*data-testid="ticker"/,
    );
  });
  it("holds what the sheet's Details tab held: the rival's hand size, the table and the Contingency decks", () => {
    expect(panel).toContain('aria-label="Game details"');
    for (const id of ["opponent", "table", "contingency"]) expect(panel).toContain(`data-testid="${id}"`);
    expect(panel).toContain("SAE holds 7 cards");
    expect(panel).toContain("Discard pile: 0 cards.");
  });
  it("shows the rival's hand only as a number: none of the rival's cards", () => {
    const rival = frameFor("sae").view.mine?.hand ?? [];
    expect(rival.length).toBeGreaterThan(0);
    for (const card of rival) expect(panel).not.toContain(cardName(card));
  });
  it("leaves only the decision banner and the hand strip at the bottom", () => {
    const bottom = /<div class="game-bottom">[^]*$/.exec(out)?.[0] ?? "";
    expect(bottom).toContain('data-testid="hand"');
    expect(bottom).not.toContain("Game details");
    expect(out.indexOf('data-testid="decision"')).toBeLessThan(out.indexOf('class="game-bottom"'));
  });
  it("gives a spectator the same ticker, from the log the page gives it", () => {
    expect(html(frameFor("spectator"), { log: ["SAE spent 2 points."] })).toContain(
      '<span class="game-ticker-line">SAE spent 2 points.</span>',
    );
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
  it("names a first-deck era by its number and years, and the future cards by theirs", () => {
    expect(html(frameFor("lio"), { era: "era-2" })).toContain("<span>Era 2 (2001–2008)</span>");
    expect(html(frameFor("lio"), { era: "future" })).toContain("<span>Future cards (2025–2027)</span>");
  });
  it("shows an era id it has no text for as it is", () => {
    expect(html(frameFor("lio"), { era: "late" })).toContain("<span>late</span>");
  });
  it("says the era is not shown yet for null", () => {
    expect(html(frameFor("lio"), { era: null })).toContain("Era not shown yet");
  });
});

describe("GameScreen for a spectator", () => {
  const out = html(frameFor("spectator"), { onAnswer: () => {} });
  it("shows two hand counts, no opponent region and Game active", () => {
    expectAll(out, ["Spectating", '<span data-side="lio">LIO 7</span><span data-side="sae">SAE 7</span>']);
    expect(out).not.toContain('data-testid="opponent"');
    expect(out).toContain("Game active");
  });
  it("shows no card ids and read-only prompts with no buttons", () => {
    expect(out).not.toMatch(/\bt\d+\b/);
    expect(out.match(/pick an opening card/g)).toHaveLength(2);
    expect(decisionOf(out)).not.toContain("<button");
  });
});

describe("the decision region", () => {
  it("shows buttons that call onAnswer", () => {
    const answers: unknown[] = [];
    const buttons = buttonsOf(<GameScreen {...props(frameFor("lio"), { onAnswer: (v) => answers.push(v) })} />);
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]?.click();
    expect(answers).toHaveLength(1);
    // The first button pressed is the decision's (the opening pick), not a map region's zoom button.
    expect(answers[0]).toMatchObject({ kind: "chooseCard" });
  });
  it("gives the yes/no prompt the frame's stack, so it names the asking card and its question", () => {
    const yesNo = { id: "d9", side: "sae" as const, kind: "yesNo" as const, options: {} };
    const asking = withPublic(frameFor("spectator"), {
      pending: [yesNo],
      stack: [{ kind: "program", source: "t2", steps: [], next: 0, vars: [] }],
    });
    const question = (card: string) => (card === "t2" ? "Hold the line?" : undefined);
    expect(html(asking, { question })).toContain("SAE, Test card 2: Hold the line?");
    expect(html(asking)).toContain("SAE: yes or no?");
  });
  it("shows the refusal code when refusal is set, and nothing when it is not", () => {
    expect(html(frameFor("lio"), { refusal: "stale_seq" })).toContain("Refused: stale_seq");
    expect(html(frameFor("lio"), { refusal: null })).not.toContain("Refused");
  });
});

describe("a game that is over", () => {
  it("names the winner as LIO or SAE and says why in words", () => {
    expect(html(over("sae", "turnLimitReached"))).toContain("Game over: SAE, the last turn ended");
    expect(html(over("lio", "resigned"))).toContain("Game over: LIO, the other side resigned");
    expect(html(over("lio", "timeout"))).toContain("Game over: LIO, time ran out");
  });
  it("says no winner for a tie", () => {
    expect(html(over(null, "turnLimitReached"))).toContain("Game over: no winner, the last turn ended");
  });
  it("shows a reason it has no words for as it is", () => {
    expect(html(over("sae"))).toContain("Game over: SAE, turns ran out");
  });
});

describe("screen-reader support", () => {
  const out = html(frameFor("lio"), { log: ["first", "second"] });
  it("puts only the state text in a polite live region (role=status)", () => {
    expect(out).toContain('<span role="status">Your decision</span>');
    expect(html({ ...frameFor("lio"), decision: null })).toContain(
      '<span role="status">Waiting for the other side</span>',
    );
    expect(html(over("sae"))).toContain('<span role="status">Game over: SAE, turns ran out</span>');
    expect(out.match(/role="status"/g)).toHaveLength(1);
    expect(out).toContain("<span>You play LIO (Liberal International Order)</span>");
  });
  it("announces the refusal as an alert, keeping its <output> and its Refused: text", () => {
    expect(html(frameFor("lio"), { refusal: "stale_seq" })).toContain(
      '<output role="alert">Refused: stale_seq</output>',
    );
  });
  it("gives the log section role=log and name Log, and keeps its <ol> a list, newest first", () => {
    expect(out).toContain('<section aria-label="Log" data-testid="log" class="game-log" role="log">');
    expect(out).toContain('<ol aria-label="Log entries" tabindex="0"><li>second</li><li>first</li></ol>');
  });
  it("marks a game with no map, so its empty map box takes only a line, and leaves a map game unmarked", () => {
    const lio = frameFor("lio");
    const noMap = { ...lio.view.public };
    delete noMap.map;
    expect(html({ ...lio, view: { ...lio.view, public: noMap } })).toContain(
      '<div class="game game-no-map" data-theme="',
    );
    expect(out).toContain('<div class="game" data-theme="');
  });
  it("lets the keyboard reach each scrolling element, each with a name", () => {
    // The hand strip scrolls sideways; its chips take the keyboard, so the strip itself needs no tabindex.
    expect(out).toContain('<section aria-label="Your hand" data-testid="hand" class="game-strip">');
    expect(out).toContain('<div role="toolbar" aria-label="Your cards" class="strip-cards">');
    expect(out).toContain('<section aria-label="Map" data-testid="map-area" class="game-map" tabindex="0">');
    expect(out).toContain('<ol aria-label="Log entries" tabindex="0">');
    expect(out).toContain('<div class="game-details-body" role="group" aria-label="Details" tabindex="0">');
  });
  it("gives a spectator's two open prompts different question ids", () => {
    const spectator = html(frameFor("spectator"));
    const ids = [...spectator.matchAll(/aria-labelledby="([^"]+)"><p id="([^"]+)"/g)];
    expect(ids).toHaveLength(2);
    for (const [, by, id] of ids) expect(by).toBe(id);
    expect(ids[0]?.[1]).not.toBe(ids[1]?.[1]);
    expect(decisionOf(spectator)).not.toContain("<button");
  });
});
