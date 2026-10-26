import { describe, expect, it } from "vitest";
import { serverOnly } from "./serverOnly.ts";
import type { FetchLike, FetchReply } from "./remoteHttp.ts";

const SERVER = "https://project.example";
const OK: FetchReply = { ok: true, status: 200, json: () => Promise.resolve([]) };
const GET = { method: "GET" as const, headers: {} };

function recording(): { calls: string[]; fetch: FetchLike } {
  const calls: string[] = [];
  return { calls, fetch: (url) => (calls.push(url), Promise.resolve(OK)) };
}

describe("serverOnly", () => {
  it("passes requests for the game's own server through", async () => {
    const r = recording();
    const reply = await serverOnly(SERVER, r.fetch)(`${SERVER}/rest/v1/match?select=clock`, GET);
    expect(reply).toBe(OK);
    expect(r.calls).toEqual([`${SERVER}/rest/v1/match?select=clock`]);
  });

  it("refuses a request for any other address, without sending it", async () => {
    const r = recording();
    const guarded = serverOnly(SERVER, r.fetch);
    await expect(guarded("https://elsewhere.example/rest/v1/match", GET)).rejects.toThrow(/game's server/);
    await expect(guarded(`${SERVER}.elsewhere.example/rest/v1/match`, GET)).rejects.toThrow(/game's server/);
    await expect(guarded(`http://project.example/rest/v1/match`, GET)).rejects.toThrow(/game's server/);
    expect(r.calls).toEqual([]);
  });

  it("allows the server's address with or without a trailing slash", async () => {
    const r = recording();
    await serverOnly(`${SERVER}/`, r.fetch)(`${SERVER}/auth/v1/otp`, GET);
    expect(r.calls).toEqual([`${SERVER}/auth/v1/otp`]);
  });
});
