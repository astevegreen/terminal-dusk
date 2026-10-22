import { describe, expect, it } from "vitest";
import { sessionToken } from "./emailAuth.ts";
import type { AuthEndpoint, Session } from "./emailAuth.ts";
import { AUTH_ANON_KEY, AUTH_URL, createFakeAuth } from "./test/fakeAuth.ts";
import type { FakeAuth } from "./test/fakeAuth.ts";

const START = 10_000_000;
const SESSION: Session = {
  accessToken: "access-0",
  refreshToken: "refresh-0",
  expiresAt: START + 3_600_000,
  userId: "user-1",
};

type Rig = { fake: FakeAuth; e: AuthEndpoint; clock: { now: number }; saved: Session[] };

function rig(): Rig {
  const fake = createFakeAuth();
  return { fake, e: { url: AUTH_URL, anonKey: AUTH_ANON_KEY, fetch: fake.fetch }, clock: { now: START }, saved: [] };
}

const tokenFor = (r: Rig, session: Session = SESSION): (() => Promise<string | null>) =>
  sessionToken(
    r.e,
    session,
    () => r.clock.now,
    (s) => r.saved.push(s),
  );

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("sessionToken", () => {
  it("returns the stored access token while it has more than 60 seconds left, with no request", async () => {
    const r = rig();
    const token = tokenFor(r);
    expect(await token()).toBe("access-0");
    r.clock.now = SESSION.expiresAt - 60_001;
    expect(await token()).toBe("access-0");
    expect(r.fake.requests).toHaveLength(0);
    expect(r.saved).toHaveLength(0);
  });

  it("refreshes once near expiry, passes the new session to save and returns the new token", async () => {
    const r = rig();
    const token = tokenFor(r);
    r.clock.now = SESSION.expiresAt - 60_000;
    expect(await token()).toBe("access-r1");
    expect(r.fake.requests).toHaveLength(1);
    expect(r.fake.requests[0]?.body).toEqual({ refresh_token: "refresh-0" });
    expect(r.saved).toEqual([
      { accessToken: "access-r1", refreshToken: "refresh-r1", expiresAt: r.clock.now + 3_600_000, userId: "user-1" },
    ]);
    expect(await token()).toBe("access-r1");
    expect(r.fake.requests).toHaveLength(1);
  });

  it("refreshes an already expired session", async () => {
    const r = rig();
    const token = tokenFor(r);
    r.clock.now = SESSION.expiresAt + 1;
    expect(await token()).toBe("access-r1");
  });

  it("shares one refresh between two calls at once", async () => {
    const r = rig();
    const token = tokenFor(r);
    r.clock.now = SESSION.expiresAt;
    const release = r.fake.hold();
    const first = token();
    const second = token();
    await settle();
    release();
    expect(await Promise.all([first, second])).toEqual(["access-r1", "access-r1"]);
    expect(r.fake.requests).toHaveLength(1);
    expect(r.saved).toHaveLength(1);
  });

  it("resolves null after a failed refresh without calling save or throwing, and the next call tries again", async () => {
    const r = rig();
    const token = tokenFor(r);
    r.clock.now = SESSION.expiresAt;
    r.fake.answerNext({ status: 400, body: { msg: "Invalid Refresh Token" } });
    expect(await token()).toBeNull();
    r.fake.answerNext("throw");
    expect(await token()).toBeNull();
    expect(r.saved).toHaveLength(0);
    expect(await token()).toBe("access-r1");
    expect(r.fake.requests).toHaveLength(3);
    expect(r.fake.requests.every((q) => JSON.stringify(q.body) === '{"refresh_token":"refresh-0"}')).toBe(true);
    expect(r.saved).toHaveLength(1);
  });
});
