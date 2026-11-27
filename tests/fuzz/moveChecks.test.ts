// What the online log's "Played for X (deadline passed)" mark rests on (#616): a side's influence is placed,
// intervened or realigned, and its tech race attempted, only by that side's own answer, even when a rival's card
// gave it the points. So the log tells the stand-in's moves by the event's side (gameText.ts, isMoveOf).
import { apply, createGame } from "@terminal-dusk/engine";
import type { Answer, GameEvent, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkOwnMoves } from "./moveChecks.ts";
import { mapGameCount, randomChooser, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";
import { onTestMap } from "./testMap.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// At least 100 games, so the random games are sure to include a rival's card giving the other side points.
const GAMES = Math.max(mapGameCount(process.env["FUZZ_GAMES"]), 100);

const answerBy = (side: Side): Answer => ({ decisionId: "d1", side, value: "pass" }) as unknown as Answer;
const eventBy = (kind: GameEvent["kind"], side: Side): GameEvent =>
  ({ kind, visibility: "public", side }) as unknown as GameEvent;
const MOVES = ["influencePlaced", "intervened", "realigned", "techRaceAttempted"] as const;

describe("the own-moves check", () => {
  it("fails a step in which one side's answer makes the other side's move", () => {
    for (const kind of MOVES) {
      expect(() => checkOwnMoves(answerBy("sae"), [eventBy(kind, "lio")])).toThrow(
        `${kind} is lio's move, but the answer was sae's`,
      );
    }
  });

  it("passes a step in which the answering side makes its own moves", () => {
    const events = MOVES.map((kind) => eventBy(kind, "lio"));
    expect(() => checkOwnMoves(answerBy("lio"), events)).not.toThrow();
  });

  it("passes the other side's points and discards: a card's event gives those without an answer", () => {
    const events = [eventBy("pointsSpent", "lio"), eventBy("cardsDiscarded", "lio")];
    expect(() => checkOwnMoves(answerBy("sae"), events)).not.toThrow();
  });

  it("fails a move made by a system answer's step", () => {
    const timeout: Answer = { system: "timeout", side: "lio" };
    expect(() => checkOwnMoves(timeout, [eventBy("influencePlaced", "lio")])).toThrow(
      "influencePlaced came from a system answer",
    );
    expect(() => checkOwnMoves(timeout, [])).not.toThrow();
  });
});

describe("random map games", () => {
  it("make every move by the mover's own answer, with points from a rival's card included", () => {
    let placed = 0;
    let rivalPoints = 0;
    let placedWithRivalPoints = 0;
    for (let game = 0; game < GAMES; game++) {
      const rng = seededRng(game);
      const { setup, seed } = randomGame(rng, game);
      const choose = randomChooser(ruleset, rng);
      const created = createGame(ruleset, onTestMap(setup), seed);
      if (!created.ok) throw new Error(`game ${game}: createGame failed: ${created.error.code}`);
      let state = created.value.state;
      // The sides now spending points that a step answered by the other side gave them.
      const fromRival = new Set<Side>();
      while (state.public.status.kind === "active") {
        const answer = choose(state)!;
        const result = apply(ruleset, state, answer);
        if (!result.ok) throw new Error(`game ${game}: apply failed: ${result.error.code}`);
        const { events } = result.value;
        checkOwnMoves(answer, events);
        for (const event of events) {
          if (event.kind === "influencePlaced") {
            placed++;
            if (fromRival.has(event.side)) placedWithRivalPoints++;
          }
          if (event.kind !== "pointsSpent") continue;
          if ("decisionId" in answer && answer.side !== event.side) {
            rivalPoints++;
            fromRival.add(event.side);
          } else fromRival.delete(event.side);
        }
        state = result.value.state;
      }
    }
    expect(placed).toBeGreaterThan(0);
    expect(rivalPoints).toBeGreaterThan(0);
    expect(placedWithRivalPoints).toBeGreaterThan(0);
  });
});
