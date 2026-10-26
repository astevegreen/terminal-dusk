// R18a: the card schema's escalate step, { "op": "escalate", "by": n }, with n a whole number other than 0.
import { describe, expect, it } from "vitest";
import { issuesOf, lioCard, yesNo } from "./test/cards.ts";

const withEffect = (effect: unknown[]) => ({ ...lioCard(), effect });
const escalate = (fields: object) => ({ op: "escalate", ...fields });
/** `step` at the top of an effect, in an if's then and else, in a forEach and in a trigger's reaction. */
const nested = (step: unknown): unknown[][] => [
  [step],
  [yesNo, { op: "if", cond: { op: "yes", var: "agreed" }, then: [step] }],
  [yesNo, { op: "if", cond: { op: "yes", var: "agreed" }, then: [], else: [step] }],
  [{ op: "forEach", over: ["a"], bind: "x", do: [step] }],
  [{ op: "trigger", hook: "turnEnd", do: [step], duration: { kind: "turnEnd" } }],
];
const messagesOf = (effect: unknown[]) => issuesOf(withEffect(effect)).map((issue) => issue.message);

describe("card schema: the escalate step", () => {
  it.each([1, -1, 2, -3])("accepts a by of %s at any depth", (by) => {
    for (const effect of nested(escalate({ by }))) expect(issuesOf(withEffect(effect))).toEqual([]);
  });

  it("rejects a by of 0 with a plain message", () => {
    for (const effect of nested(escalate({ by: 0 }))) {
      expect(messagesOf(effect)).toEqual(["An escalate step's by must not be 0."]);
    }
  });

  it.each([
    ["a non-whole by", { by: 0.5 }],
    ["a missing by", {}],
    ["a by that is text", { by: "1" }],
  ])("rejects %s with a plain message", (_case, fields) => {
    for (const effect of nested(escalate(fields))) {
      expect(messagesOf(effect)).toEqual(["An escalate step's by must be a whole number, such as 1 or -1."]);
    }
  });

  it("rejects an extra key with a message naming it", () => {
    for (const effect of nested(escalate({ by: 1, side: "lio" }))) {
      expect(messagesOf(effect)).toEqual(['Unrecognized key: "side"']);
    }
  });
});
