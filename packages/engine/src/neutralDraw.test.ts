// A neutral card's draw (decision 17, docs/design/contingency-deck.md): "side": "player" draws from the deck
// of the side that played the card, whichever side answers its choices. Neutral cards are points only for now
// (decisions.ts), so these tests start the event's program directly, naming who played it.
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./decisions.ts";
import type { GameEvent, GameState, Ruleset, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { applied, choose, forEach, ifYes, marker, markers, ruleset, startAtPlay, yesNoAnswer } from "./test/game.ts";

const drawPlayer: Step = { op: "drawContingency", side: "player", bind: "n" };
const drawn = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "contingencyDrawn");

/** Starts `steps` as neutral card n1's event, played by `player`, and expects it to be accepted. */
function runFor(player: Side | undefined, steps: Step[], state: GameState = startAtPlay()) {
  const r = startProgram(ruleset, state, steps, "n1", player);
  if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
  return r.value;
}

/** Answers the first legal answer to each decision until the turn ends, collecting every event. */
function playOutTurn(state: GameState, rs: Ruleset = ruleset): GameEvent[] {
  const turn = state.public.turn;
  const events: GameEvent[] = [];
  let s = state;
  while (s.public.turn === turn && s.public.status.kind === "active") {
    const d = s.public.pending[0];
    if (!d) throw new Error("no decision pending");
    const r = applied(s, { decisionId: d.id, side: d.side, value: legalAnswers(rs, s, d.side)[0]! }, rs);
    events.push(...r.events);
    s = r.state;
  }
  return events;
}

describe("a draw from the player's deck", () => {
  it.each(["lio", "sae"] as const)("draws from %s's deck when that side played the card", (player) => {
    const s = startAtPlay();
    const other = player === "lio" ? "sae" : "lio";
    const r = runFor(player, [drawPlayer, marker("drew", "n")], s);
    expect(drawn(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: player, value: s.secret.contingency[player][0] },
    ]);
    expect(markers(r.events)).toEqual([`drew:${s.secret.contingency[player][0]}`]);
    expect(r.state.secret.contingency[other]).toEqual(s.secret.contingency[other]);
  });

  it("still draws from the player's deck after the rival answers a choice", () => {
    const s = startAtPlay();
    const paused = runFor("lio", [choose("go", "sae"), ifYes("go", [drawPlayer])], s);
    const r = applied(paused.state, yesNoAnswer(paused.state, true, "sae"));
    expect(drawn(r.events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "lio", value: s.secret.contingency.lio[0] },
    ]);
    expect(r.state.secret.contingency.sae).toEqual(s.secret.contingency.sae);
  });

  it("inside a forEach, reads who played the card from its program", () => {
    const s = startAtPlay();
    const r = runFor("sae", [forEach(["a", "b"], "x", [drawPlayer])], s);
    expect(drawn(r.events).map((e) => e.kind === "contingencyDrawn" && e.side)).toEqual(["sae", "sae"]);
  });

  it("returns invalidProgram when nothing says who played the card", () => {
    const r = startProgram(ruleset, startAtPlay(), [drawPlayer], "n1");
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });

  it("a trigger the event leaves behind draws from the deck of the side that played the card", () => {
    const s = startAtPlay();
    const trigger: Step = { op: "trigger", hook: "turnEnd", do: [drawPlayer], duration: { kind: "turnEnd" } };
    // LIO played the card; SAE makes the turn's last play, so the reaction runs after SAE's play.
    const set = runFor("lio", [trigger], s);
    expect(set.state.public.triggers).toMatchObject([{ source: "n1", player: "lio" }]);
    const events = playOutTurn(set.state);
    expect(drawn(events)).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "lio", value: s.secret.contingency.lio[0] },
    ]);
  });
});
