// Turn-end-place (#426; docs/design/map-and-points.md, "Event points"): points a turnEnd trigger spends may only
// place influence (owner, 28 Oct). An intervention in a battleground raises Escalation however it turns out, so a
// 1-point intervention just before the track falls would be a cheap lever. Built on the test map (test/map.ts):
// LIO starts with 2 in alpha and 1 in charlie, SAE with 3 in echo and 1 in charlie, so an intervention and a
// realignment are both possible for LIO at the start.
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./index.ts";
import type { GameState, HookId, Ruleset, Side, Step } from "./index.ts";
import { accepted, playAnswer, sideCard, withCards } from "./test/game.ts";
import { mapGame, spend } from "./test/mapGame.ts";

/** A `trigger` step: on `hook`, run `reaction`, until the end of the turn. */
const trigger = (hook: HookId, reaction: Step[]): Step => ({
  op: "trigger",
  hook,
  do: reaction,
  duration: { kind: "turnEnd" },
});

/** l2's event sets `step`; s2 has no event. */
const rulesFor = (step: Step): Ruleset => withCards(sideCard("l2", 1, [step]), sideCard("s2", 1));

/** LIO plays l2 for its event, then SAE plays s2 for its event: the turn's last play. */
function bothPlay(start: GameState, rs: Ruleset): GameState {
  const lio = accepted(start, playAnswer(start, "lio", "l2", "event"), rs);
  return accepted(lio, playAnswer(lio, "sae", "s2", "event"), rs);
}

const pendingKinds = (state: GameState, side: Side) =>
  state.public.pending.filter((d) => d.side === side).map((d) => d.kind);

describe("Turn-end-place: a turn-end payment only places influence (#426)", () => {
  it("goes straight to placing, though an intervention and a realignment are possible", () => {
    const rs = rulesFor(trigger("turnEnd", [spend("lio", 1)]));
    const ended = bothPlay(mapGame(), rs);
    expect(ended.public.pending).toEqual([
      expect.objectContaining({ side: "lio", kind: "placeInfluence", options: expect.objectContaining({ points: 1 }) }),
    ]);
    expect(legalAnswers(rs, ended, "lio").every((a) => a.kind === "placeInfluence")).toBe(true);
  });

  it("spends a payment of 2 on placing too", () => {
    const rs = rulesFor(trigger("turnEnd", [spend("lio", 2)]));
    const ended = bothPlay(mapGame(), rs);
    expect(ended.public.pending).toEqual([
      expect.objectContaining({ side: "lio", kind: "placeInfluence", options: expect.objectContaining({ points: 2 }) }),
    ]);
  });

  it("with no placement affordable, the points are lost and the next turn starts", () => {
    // SAE controls alpha (stability 2) with 2, LIO's only reach: 1 point cannot buy an influence there, though it
    // could pay for an intervention in alpha or a realignment.
    const rs = rulesFor(trigger("turnEnd", [spend("lio", 1)]));
    const ended = bothPlay(mapGame({ alpha: { sae: 2 } }), rs);
    expect(ended.public.turn).toBe(2);
    // Nothing is asked about the lost point: both sides pick turn 2's opening card.
    expect(pendingKinds(ended, "lio")).toEqual(["chooseCard"]);
    expect(pendingKinds(ended, "sae")).toEqual(["chooseCard"]);
  });

  it("leaves spends during the turn alone: a cardPlayed payment still offers the action menu", () => {
    const rs = rulesFor(trigger("cardPlayed", [spend("lio", 1)]));
    const lio = accepted(mapGame(), playAnswer(mapGame(), "lio", "l2", "event"), rs);
    const sae = accepted(lio, playAnswer(lio, "sae", "s2", "event"), rs);
    expect(sae.public.pending).toEqual([
      expect.objectContaining({
        side: "lio",
        kind: "chooseAction",
        options: expect.objectContaining({ actions: ["place", "intervene", "realign"] }),
      }),
    ]);
  });
});
