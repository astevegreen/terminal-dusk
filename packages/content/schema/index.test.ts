import { describe, expect, it } from "vitest";
import { cardSchema } from "./card.ts";
import { schemas } from "./index.ts";

describe("content schemas", () => {
  it("checks card files, and only card files so far, with the card schema", () => {
    expect(Object.keys(schemas)).toEqual(["cards"]);
    expect(schemas.cards).toBe(cardSchema);
  });
});
