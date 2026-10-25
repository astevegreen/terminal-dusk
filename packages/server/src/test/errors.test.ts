// O12, acceptance criterion 2: `shown` prints a plain-object cause by its fields, never "[object Object]".
import { describe, expect, it } from "vitest";
import { shown } from "./errors.ts";

describe("shown: everything a thrown error shows", () => {
  it("includes the fields of a cause that is a plain object", () => {
    const text = shown(new Error("query failed", { cause: { code: "57014" } }));
    expect(text).toContain("57014");
    expect(text).toContain("query failed");
    expect(text).not.toContain("[object Object]");
  });

  it("still shows a string cause's text", () => {
    expect(shown(new Error("outer", { cause: "socket closed" }))).toContain("socket closed");
  });

  it("still shows an Error cause's text", () => {
    const text = shown(new Error("outer", { cause: new Error("inner timeout") }));
    expect(text).toContain("inner timeout");
    expect(text).not.toContain("[object Object]");
  });

  it("shows a non-Error object passed to it by its fields", () => {
    const text = shown({ code: "PGRST116", details: "no rows" });
    expect(text).toContain("PGRST116");
    expect(text).toContain("no rows");
    expect(text).not.toContain("[object Object]");
  });

  it("shows a primitive passed to it as its text", () => {
    expect(shown("plain text")).toBe("plain text");
    expect(shown(42)).toBe("42");
    expect(shown(undefined)).toBe("undefined");
  });

  it("shows an error with no cause without the text [object Object]", () => {
    const text = shown(new TypeError("bad"));
    expect(text).toContain("TypeError bad");
    expect(text).not.toContain("[object Object]");
  });
});
