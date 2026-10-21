// Type-level check, run by `tsc`: the scenario schema and the engine's Setup can't drift apart.
import type { Setup } from "@terminal-dusk/engine";
import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { ScenarioSetup } from "../src/scenario.ts";
import type { scenarioSchema } from "./scenario.ts";

type Scenario = z.output<typeof scenarioSchema>;

describe("scenario schema types", () => {
  it("gives a scenario whose fields fit the engine's Setup fields", () => {
    expectTypeOf<Pick<Scenario, "turns" | "playsPerTurn" | "handSize">>().toExtend<
      Pick<Setup, "turns" | "playsPerTurn" | "handSize">
    >();
    expectTypeOf<NonNullable<Scenario["eras"]>>().toExtend<NonNullable<Setup["eras"]>>();
    expectTypeOf<NonNullable<NonNullable<Scenario["contingency"]>["lio"]>>().toEqualTypeOf<
      Setup["contingency"]["lio"]
    >();
    expectTypeOf<NonNullable<NonNullable<Scenario["contingency"]>["world"]>>().toEqualTypeOf<
      Setup["contingency"]["world"]
    >();
    expectTypeOf<keyof NonNullable<Scenario["contingency"]>>().toEqualTypeOf<keyof Setup["contingency"]>();
  });

  it("makes scenarioSetup return exactly those Setup fields", () => {
    expectTypeOf<ScenarioSetup>().toEqualTypeOf<
      Pick<Setup, "turns" | "playsPerTurn" | "handSize" | "eras" | "contingency">
    >();
  });
});
