// Type-level checks, run by `tsc` (the typecheck script): the card schema and the engine's types can't drift apart.
import type { CardDef } from "@terminal-dusk/engine";
import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import { cardSchema, stepSchema } from "./card.ts";
import type { CardStep } from "./card.ts";

/**
 * Each kind of step without the lists of steps it holds. The engine's type allows a card choice in those
 * lists; the schema refuses one at any depth, so the lists are compared as CardStep lists, one level down.
 */
type WithoutBlocks<S> = S extends unknown ? Omit<S, "then" | "else" | "do"> : never;
/** For each kind of step, the names of its fields, optional ones too. */
type FieldsOf<S> = { [Op in S extends { op: infer O extends string } ? O : never]: keyof Extract<S, { op: Op }> };

describe("card schema types", () => {
  it("gives cards the engine can use: every card the schema accepts is an engine CardDef", () => {
    expectTypeOf<z.output<typeof cardSchema>>().toExtend<CardDef>();
  });

  it("has the same flags as the engine, each taking the same values", () => {
    type SchemaFlags = NonNullable<z.input<typeof cardSchema>["flags"]>;
    type EngineFlags = NonNullable<CardDef["flags"]>;
    expectTypeOf<keyof SchemaFlags>().toEqualTypeOf<keyof EngineFlags>();
    expectTypeOf<SchemaFlags["removeAfterEvent"]>().toEqualTypeOf<EngineFlags["removeAfterEvent"]>();
  });

  it("accepts every kind of engine step except a card choice", () => {
    // The same kinds of step, each with the same fields: a field the schema lacked would be refused as unknown.
    expectTypeOf<FieldsOf<z.input<typeof stepSchema>>>().toEqualTypeOf<FieldsOf<CardStep>>();
    // Each field accepts every value the engine allows.
    expectTypeOf<WithoutBlocks<CardStep>>().toExtend<WithoutBlocks<z.input<typeof stepSchema>>>();
  });

  it("holds lists of the same steps inside an if, a forEach and a trigger", () => {
    type If = Extract<z.input<typeof stepSchema>, { op: "if" }>;
    type ForEach = Extract<z.input<typeof stepSchema>, { op: "forEach" }>;
    type Trigger = Extract<z.input<typeof stepSchema>, { op: "trigger" }>;
    expectTypeOf<If["then"]>().toEqualTypeOf<CardStep[]>();
    expectTypeOf<ForEach["do"]>().toEqualTypeOf<CardStep[]>();
    expectTypeOf<Trigger["do"]>().toEqualTypeOf<CardStep[]>();
  });
});
