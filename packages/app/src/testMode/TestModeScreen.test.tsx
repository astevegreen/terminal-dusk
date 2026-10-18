import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import { decisionPrompts } from "../decisionPrompts.tsx";
import { TestModeView } from "./TestModeScreen.tsx";
import { buttonsOf } from "./promptTree.ts";
import { cardName } from "./fixture.ts";
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
      label: cardName,
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
    expect(renderToString(<App clock={clock} />)).toContain("Test mode</button>");
  });
  it("renders the turn, the plays, the hand and the open prompt from the frame", () => {
    const out = html(fresh());
    expect(out).toContain("Turn 1 of 2");
    expect(out).toContain("Plays made: 0 of 2");
    expect(out).toContain("Game active");
    expect(out).toContain(
      "Your hand: Test card 1, Test card 2, Test card 3, Test card 4, Test card 5, Test card 7, Test card 13",
    );
    expect(out).toContain("sae hand: 7 cards");
    expect(out).toContain("lio: pick an opening card");
    expect(out).toContain("min-height:44px");
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
    expect(out).toContain("Viewing as sae");
    expect(out).toContain(
      "Your hand: Test card 9, Test card 10, Test card 11, Test card 12, Test card 8, Test card 6, Test card 14",
    );
    expect(out).toContain("lio hand: 7 cards");
  });
  it("shows a spectator two hand counts, no card ids, read-only prompts and no answer buttons", () => {
    const session = fresh();
    session.setViewer("spectator");
    const out = html(session);
    expect(out).toContain("Hands: lio 7 cards, sae 7 cards");
    expect(out).not.toContain("Your hand");
    expect(out).not.toMatch(/\bt\d+\b/);
    expect(out).not.toContain("Test card 1,");
    expect(out.match(/pick an opening card/g)).toHaveLength(2);
    // Only the three viewer controls and Restart are buttons.
    expect(out.match(/<button/g)).toHaveLength(4);
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
    expect([...seen].sort()).toEqual(["chooseCard", "playCardAs", "rivalEventOrder", "yesNo"]);
    // A card really was played for its event, and it ended up in the discard pile.
    const eventPlays = accepted.flatMap((a) => (a.kind === "playCardAs" && a.as === "event" ? [a.card] : []));
    expect(eventPlays.length).toBeGreaterThan(0);
    const pub = session.getSnapshot().frame?.view.public;
    expect(eventPlays.some((card) => pub?.discard.includes(card) || pub?.inPlay.includes(card))).toBe(true);
    expect(html(session)).toContain("Game over");
    expect(session.getSnapshot().frame?.view.public.status.kind).toBe("over");
  });
});
