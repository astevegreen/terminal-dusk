import { describe, expect, it } from "vitest";
import { matchIdFromSearch, watchLinkFor } from "./watchLink.ts";

describe("watch links", () => {
  it("a link carries the match id and reads back", () => {
    const link = watchLinkFor("https://play.example/", "match-1");
    expect(link).toBe("https://play.example/?watch=match-1");
    expect(matchIdFromSearch(new URL(link).search)).toBe("match-1");
  });

  it("an id with odd characters survives the round trip", () => {
    const link = watchLinkFor("https://play.example/", "a b&c");
    expect(matchIdFromSearch(new URL(link).search)).toBe("a b&c");
  });

  it("a page address with no watch, or an empty one, is not a watch link", () => {
    expect(matchIdFromSearch("")).toBeNull();
    expect(matchIdFromSearch("?x=1")).toBeNull();
    expect(matchIdFromSearch("?watch=")).toBeNull();
  });
});
