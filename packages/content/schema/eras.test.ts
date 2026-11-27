import { describe, expect, it } from "vitest";
import { erasSchema } from "./eras.ts";
import { schemas } from "./index.ts";

const first = { id: "era-1", label: "Era 1", name: "The Thaw", from: 1991, to: 2001 };
const future = { id: "future", label: "Future cards", from: 2025, to: 2027 };
/** The paths of every problem the schema finds in `data`. */
const paths = (data: unknown): unknown[][] => {
  const r = erasSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};

describe("era data schema", () => {
  it("accepts eras with a name, and one without", () => {
    expect(paths({ eras: [first, future] })).toEqual([]);
  });
  it("is the schema content:check uses for packages/content/eras/", () => {
    expect(schemas.eras).toBe(erasSchema);
  });
  it("refuses an empty list", () => {
    expect(paths({ eras: [] })).toEqual([["eras"]]);
  });
  it("refuses an id used twice", () => {
    expect(paths({ eras: [first, { ...future, id: "era-1" }] })).toEqual([["eras", 1, "id"]]);
  });
  it("refuses an era that does not end after it starts", () => {
    expect(paths({ eras: [{ ...first, to: 1991 }] })).toEqual([["eras", 0, "to"]]);
  });
  it("refuses a year that is not a whole number", () => {
    expect(paths({ eras: [{ ...first, from: 1991.5 }] })).toEqual([["eras", 0, "from"]]);
  });
  it("refuses an empty id, label or name, and a name written as undefined", () => {
    for (const key of ["id", "label", "name"]) {
      expect(paths({ eras: [{ ...first, [key]: "" }] })).toEqual([["eras", 0, key]]);
    }
    expect(paths({ eras: [{ ...first, name: undefined }] })).toEqual([["eras", 0, "name"]]);
  });
  it("refuses other fields", () => {
    expect(paths({ eras: [{ ...first, theme: "terminal" }] })).toEqual([["eras", 0]]);
    expect(paths({ eras: [first], extra: 1 })).toEqual([[]]);
  });
});
