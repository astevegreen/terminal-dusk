// Reading the signed-in player's own `entitlement` rows (#686), against a fake `fetch` that records each request.
import { describe, expect, it } from "vitest";
import type { LobbyEndpoint } from "../online/lobbyHttp.ts";
import { readEntitlements } from "./read.ts";
import { fakeEntitlements } from "./test/fakeEntitlements.ts";

const endpointOf = (fake: ReturnType<typeof fakeEntitlements>): LobbyEndpoint => ({
  url: "https://fake.supabase.test",
  anonKey: "fake-anon-key",
  fetch: fake.fetch,
});

describe("reading the player's own entitlement rows (#686)", () => {
  it("asks the entitlement table for that player's rows, with their token", async () => {
    const fake = fakeEntitlements();
    await readEntitlements(endpointOf(fake), "access-0", "user-0");
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.url).toBe(
      "https://fake.supabase.test/rest/v1/entitlement?select=platform,source&player=eq.user-0",
    );
    expect(fake.requests[0]!.method).toBe("GET");
    expect(fake.requests[0]!.headers).toMatchObject({
      apikey: "fake-anon-key",
      Authorization: "Bearer access-0",
    });
  });

  it("gives the rows as entitlements, keeping only platform and source", async () => {
    const fake = fakeEntitlements();
    fake.answerNext({ status: 200, body: [{ platform: "web", source: "stripe", receipt_ref: "r1" }] });
    await expect(readEntitlements(endpointOf(fake), "t", "user-0")).resolves.toEqual({
      ok: true,
      value: [{ platform: "web", source: "stripe" }],
    });
  });

  it("gives an empty list for a player who owns nothing", async () => {
    const fake = fakeEntitlements();
    await expect(readEntitlements(endpointOf(fake), "t", "user-0")).resolves.toEqual({ ok: true, value: [] });
  });

  it.each([
    ["a dropped connection", "throw" as const],
    ["a server error", { status: 500, body: { message: "boom" } }],
    ["a body that is not a list", { status: 200, body: { platform: "web" } }],
    ["a row that is not an entitlement", { status: 200, body: [{ platform: "amiga", source: "x" }] }],
  ])("refuses %s rather than answering that nothing is owned", async (_name, answer) => {
    const fake = fakeEntitlements();
    fake.answerNext(answer);
    const result = await readEntitlements(endpointOf(fake), "t", "user-0");
    expect(result.ok).toBe(false);
  });
});
