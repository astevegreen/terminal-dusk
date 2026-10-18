import { describe, expect, it } from "vitest";
import { cardSchema } from "./card.ts";
import { schemas } from "./index.ts";
import { scenarioSchema } from "./scenario.ts";

describe("content schemas", () => {
  it("checks card files with the card schema and scenario files with the scenario schema", () => {
    expect(Object.keys(schemas)).toEqual(["cards", "scenarios"]);
    expect(schemas.cards).toBe(cardSchema);
    expect(schemas.scenarios).toBe(scenarioSchema);
  });
});
