import type { ReplayArchive } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { toRecording } from "./recording.ts";

const archive = {
  matchId: "m1",
  ruleset: "r",
  players: { lio: "a", sae: "b" },
  seedHash: "hash-1",
  seed: "secret-seed",
  setup: { seedHash: "hash-1" },
  log: [{ decisionId: "d" }],
  status: { kind: "over", winner: "lio", reason: "resigned" },
  frames: [{ seq: 0 }, { seq: 1 }],
} as unknown as ReplayArchive;

describe("toRecording", () => {
  it("keeps the match id, seed hash, status and frames", () => {
    const recording = toRecording(archive);
    expect(recording.matchId).toBe("m1");
    expect(recording.seedHash).toBe("hash-1");
    expect(recording.status).toEqual(archive.status);
    expect(recording.frames).toEqual(archive.frames);
  });

  it("has no seed, setup or log key, and its text never holds the seed", () => {
    const recording = toRecording(archive);
    expect(Object.keys(recording).sort()).toEqual(["frames", "matchId", "seedHash", "status"]);
    expect(JSON.stringify(recording)).not.toContain("secret-seed");
  });
});
