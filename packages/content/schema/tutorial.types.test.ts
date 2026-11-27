// Type-level check, run by `tsc`: the lesson schema's kind lists can't drift from the engine's unions, so a lesson
// naming an unknown Decision or event kind fails the schema, and a new engine kind fails this check until it is
// listed.
import type { AnswerValue, DecisionKind, EventKind, PlayUse, PointsAction } from "@terminal-dusk/engine";
import { describe, expectTypeOf, it } from "vitest";
import type { ANSWER_KINDS, DECISION_KINDS, EVENT_KINDS, PLAY_USES, POINTS_ACTIONS } from "./tutorial.ts";

describe("tutorial schema types", () => {
  it("lists exactly the engine's Decision kinds", () => {
    expectTypeOf<(typeof DECISION_KINDS)[number]>().toEqualTypeOf<DecisionKind>();
  });
  it("lists exactly the engine's event kinds", () => {
    expectTypeOf<(typeof EVENT_KINDS)[number]>().toEqualTypeOf<EventKind>();
  });
  it("lists exactly the engine's answer kinds, play uses and points actions", () => {
    expectTypeOf<(typeof ANSWER_KINDS)[number]>().toEqualTypeOf<AnswerValue["kind"]>();
    expectTypeOf<(typeof PLAY_USES)[number]>().toEqualTypeOf<PlayUse>();
    expectTypeOf<(typeof POINTS_ACTIONS)[number]>().toEqualTypeOf<PointsAction>();
  });
});
