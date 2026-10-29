// Guards src/game/map/world/blueMarble.webp, the picture `pnpm map:build` made (L3, #479): a WebP at the size the
// map draws it, within its 500 KB budget so the map loads quickly on a phone. It reads the file with Node, as
// server.test.ts does, so it sits in e2e/; Vitest still runs it with the unit tests.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const picture = readFileSync(new URL("../src/game/map/world/blueMarble.webp", import.meta.url));

describe("the world picture", () => {
  it("is a WebP file", () => {
    expect(picture.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(picture.subarray(8, 12).toString("latin1")).toBe("WEBP");
  });

  it("is within its 500 KB budget", () => {
    expect(picture.length).toBeLessThanOrEqual(500 * 1024);
  });
});
