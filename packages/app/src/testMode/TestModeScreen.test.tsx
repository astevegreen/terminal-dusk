import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import { decisionPrompts } from "../decisionPrompts.tsx";
import { byCodeUnit } from "../test/order.ts";
import { TestModeView } from "./TestModeScreen.tsx";
import { buttonsOf } from "./promptTree.ts";
import { cardAffiliation, cardName, cardQuestion } from "./fixture.ts";
import { createTestSession } from "./session.ts";
import type { TestSession } from "./session.ts";
import type { AnswerValue } from "@terminal-dusk/engine";

let tick = 0;
const clock = (): number => 1_700_000_000_000 + tick++;
const fresh = (seed?: string): TestSession => createTestSession(clock, seed);
const html = (session: TestSession): string =>
  renderToString(<TestModeView snapshot={session.getSnapshot()} session={session} />);

/** Presses the first prompt button the screen offers (in `order`) that the transport does not refuse. */
async function answerOnce(session: TestSession, order: "first" | "last", accepted?: AnswerValue[]): Promise<string> {
  let pressed: AnswerValue | null = null;
  const decision = session.getSnapshot().frame?.decision;
  if (!decision) throw new Error("nothing to answer");
  const hand = session.getSnapshot().frame?.view.mine?.hand ?? [];
  const buttons = buttonsOf(
    createElement(decisionPrompts[decision.kind], {
      decision,
      hand,
      known: session.getSnapshot().frame?.view.mine?.knowledge ?? [],
      label: cardName,
      stack: session.getSnapshot().frame?.view.public.stack ?? [],
      question: cardQuestion,
      affiliation: cardAffiliation,
      onAnswer: (value) => {
        pressed = value;
        void session.answer(value);
      },
    }),
  );
  for (const button of order === "first" ? buttons : [...buttons].reverse()) {
    const before = session.getSnapshot().frame?.seq;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (session.getSnapshot().frame?.seq !== before) {
      if (pressed) accepted?.push(pressed);
      return decision.kind;
    }
    if (session.getSnapshot().viewer !== "spectator" && session.getSnapshot().frame?.decision === null)
      return decision.kind;
  }
  throw new Error(`every button for ${decision.kind} was refused`);
}

describe("test mode screen", () => {
  it("has a Test mode button on the placeholder screen and opens the screen", () => {
    expect(renderToString(<App clock={clock} newSeed={() => "s"} newAiSeed={() => 1} />)).toContain(
      "Test mode</button>",
    );
  });
  it("renders the turn, the plays, the hand and the open prompt from the frame", () => {
    const out = html(fresh());
    const texts = [
      "Turn 1 of 2",
      "Plays made: 0 of 2",
      "Your decision",
      "<li>Test card 1</li><li>Test card 2</li><li>Test card 3</li><li>Test card 4</li><li>Test card 5</li><li>Test card 7</li><li>Test card 13</li>",
      "SAE holds 7 cards",
      "lio: pick an opening card",
      "min-height:44px",
    ];
    for (const text of texts) expect(out).toContain(text);
  });
  it("shows the game's events as a log, oldest first, once cards are revealed", async () => {
    const session = fresh();
    await answerOnce(session, "first");
    session.setViewer("sae");
    await answerOnce(session, "first");
    const lines = session.getSnapshot().log;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => line.startsWith("Marker Test card"))).toBe(true);
    expect(html(session)).toContain(`<li>${lines[0]}</li>`);
  });
});

describe("the viewer switch", () => {
  it("shows SAE's own hand after switching to SAE", () => {
    const session = fresh();
    session.setViewer("sae");
    const out = html(session);
    expect(out).toContain("You play SAE");
    expect(out).toContain(
      "<li>Test card 9</li><li>Test card 10</li><li>Test card 11</li><li>Test card 12</li><li>Test card 8</li><li>Test card 6</li><li>Test card 14</li>",
    );
    expect(out).toContain("LIO holds 7 cards");
  });
  it("shows a spectator two hand counts, no card ids, read-only prompts and no answer buttons", () => {
    const session = fresh();
    session.setViewer("spectator");
    const out = html(session);
    expect(out).toContain("LIO holds 7 cards, SAE holds 7 cards");
    expect(out).not.toContain('data-testid="opponent"');
    expect(out).not.toMatch(/\bt\d+\b/);
    expect(out).not.toContain("Test card 1,");
    expect(out.match(/pick an opening card/g)).toHaveLength(2);
    // Outside the map (whose region buttons zoom, for every viewer: issue #366), only the three viewer controls
    // and Restart are buttons, so the Decision region has none.
    const map = /<section aria-label="Map"[^]*?<\/section>/.exec(out)?.[0] ?? "";
    expect(map).toContain("<button");
    expect(out.replace(map, "").match(/<button/g)).toHaveLength(4);
  });
  it("marks the chosen viewer", () => {
    const session = fresh();
    session.setViewer("spectator");
    expect(html(session)).toMatch(/aria-pressed="true"[^>]*>Spectator/);
  });
});

describe("a refused answer", () => {
  it("shows the error code in the status line and leaves the frame as it was", async () => {
    const session = fresh();
    const before = session.getSnapshot();
    await session.answer({ kind: "chooseCard", card: "t14" });
    const after = session.getSnapshot();
    expect(after.refusal).not.toBeNull();
    expect(after.frame).toBe(before.frame);
    expect(after.log).toEqual(before.log);
    expect(html(session)).toContain(`Refused: ${after.refusal}`);
  });
  it("clears the refusal once the next frame arrives", async () => {
    const session = fresh();
    await session.answer({ kind: "yesNo", yes: true });
    expect(session.getSnapshot().refusal).not.toBeNull();
    await answerOnce(session, "first");
    expect(session.getSnapshot().refusal).toBeNull();
  });
});

describe("the seed box", () => {
  it("defaults to test-mode", () => {
    expect(html(fresh())).toContain('value="test-mode"');
  });
  it("restarting with the same seed shows the same first frame and log", async () => {
    const session = fresh("abc");
    const first = session.getSnapshot();
    await answerOnce(session, "first");
    expect(session.getSnapshot().frame?.seq).toBeGreaterThan(0);
    session.restart("abc");
    expect(session.getSnapshot().frame?.seq).toBe(first.frame?.seq);
    expect(session.getSnapshot().frame?.view).toEqual(first.frame?.view);
    expect(session.getSnapshot().log).toEqual(first.log);
  });
  it("restarting with another seed starts a fresh match at seq 0", async () => {
    const session = fresh("abc");
    await answerOnce(session, "first");
    session.restart("another");
    const snapshot = session.getSnapshot();
    expect(snapshot.seed).toBe("another");
    expect(snapshot.frame?.seq).toBe(0);
    expect(snapshot.log).toEqual([]);
  });
});

describe("a whole game through the prompts", () => {
  it("plays every kind of prompt to the end of the 2-turn fixture and shows the game over", async () => {
    const session = fresh();
    const seen = new Set<string>();
    const accepted: AnswerValue[] = [];
    for (let step = 0; step < 100 && session.getSnapshot().frame?.view.public.status.kind === "active"; step++) {
      let acted = false;
      for (const viewer of ["lio", "sae"] as const) {
        session.setViewer(viewer);
        if (session.getSnapshot().frame?.decision) {
          seen.add(await answerOnce(session, viewer === "lio" ? "last" : "first", accepted));
          acted = true;
          break;
        }
      }
      if (!acted) throw new Error("nobody has a prompt");
    }
    // On the test map a play for points first asks for the action (R16b), and placing then asks for each placement.
    expect([...seen].sort(byCodeUnit)).toEqual([
      "chooseAction",
      "chooseCard",
      "placeInfluence",
      "playCardAs",
      "rivalEventOrder",
      "yesNo",
    ]);
    // A card really was played for its event, and it ended up in the discard pile.
    const eventPlays = accepted.flatMap((a) => (a.kind === "playCardAs" && a.as === "event" ? [a.card] : []));
    expect(eventPlays.length).toBeGreaterThan(0);
    const pub = session.getSnapshot().frame?.view.public;
    expect(eventPlays.some((card) => pub?.discard.includes(card) || pub?.inPlay.includes(card))).toBe(true);
    expect(html(session)).toContain("Game over");
    expect(session.getSnapshot().frame?.view.public.status.kind).toBe("over");
    // The game was played on the test map (issue #366), which is still there at the end.
    expect(pub?.map?.countries).toHaveLength(12);
  });
});

describe("the replay after a whole game", () => {
  const SEED = "typed-seed-4417";
  async function finish(session: TestSession): Promise<void> {
    for (let step = 0; step < 100 && session.getSnapshot().frame?.view.public.status.kind === "active"; step++) {
      for (const viewer of ["lio", "sae"] as const) {
        session.setViewer(viewer);
        if (session.getSnapshot().frame?.decision) {
          await answerOnce(session, "first");
          break;
        }
      }
    }
  }

  it("is not ready during the game, and the screen offers no Watch replay button", () => {
    const session = fresh(SEED);
    expect(session.getSnapshot().replayReady).toBe(false);
    expect(session.replay()).toBeNull();
    expect(html(session)).not.toContain("Watch replay");
  });

  it("is ready once the game is over: Watch replay shows, and replay() gives a recording without the seed", async () => {
    const session = fresh(SEED);
    await finish(session);
    expect(session.getSnapshot().replayReady).toBe(true);
    expect(html(session)).toContain("Watch replay</button>");
    const recording = session.replay();
    expect(recording?.frames.length).toBeGreaterThan(2);
    expect(recording?.status.kind).toBe("over");
    expect(Object.keys(recording!).sort(byCodeUnit)).toEqual(["frames", "matchId", "seedHash", "status"]);
    // The typed seed is the screen's own input; nothing else in the snapshot or the recording holds it.
    const { seed, ...rest } = session.getSnapshot();
    expect(seed).toBe(SEED);
    expect(JSON.stringify(rest)).not.toContain(SEED);
    expect(JSON.stringify(recording)).not.toContain(SEED);
  });

  it("goes back to not ready on Restart", async () => {
    const session = fresh(SEED);
    await finish(session);
    session.restart("another");
    expect(session.getSnapshot().replayReady).toBe(false);
    expect(session.replay()).toBeNull();
  });
});
