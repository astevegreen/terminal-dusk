import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { InviteDeps, InviteOutcome } from "./invite.ts";
import type { InviteStore, SideMode } from "./inviteStore.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER, sequence } from "./test/invites.ts";

const refused = (code: string) => ({ ok: false, error: expect.objectContaining({ code }) });

async function codeFor(deps: InviteDeps, sides: SideMode): Promise<string> {
  const made = await createInvite(deps, { host: HOST, sides, platform: "web", now: INVITE_NOW });
  if (!made.ok) throw new Error(made.error.code);
  return made.value.code;
}

/** An invite store whose calls all reject. */
const brokenStore = (): InviteStore => ({
  save: () => Promise.reject(new Error("save failed")),
  find: () => Promise.reject(new Error("find failed")),
  accept: () => Promise.reject(new Error("accept failed")),
});

describe("createInvite refusals", () => {
  const bad: [string, unknown][] = [
    ["no mode", {}],
    ["an unknown mode", { mode: "coin" }],
    ["host mode without a side", { mode: "host" }],
    ["host mode with a side that is not lio or sae", { mode: "host", hostSide: "both" }],
    ["random mode with a host side", { mode: "random", hostSide: "lio" }],
    ["invitee mode with an extra field", { mode: "invitee", extra: 1 }],
    ["a string", "random"],
    ["null", null],
    ["a list", [{ mode: "random" }]],
  ];
  for (const [name, sides] of bad) {
    it(`a side mode that is ${name} gives invalidInvite and stores nothing`, async () => {
      const { deps, invites } = inviteWorld();
      const made = await createInvite(deps, { host: HOST, sides: sides as SideMode, platform: "web", now: INVITE_NOW });
      expect(made).toEqual(refused("invalidInvite"));
      expect(await invites.find("CODE0001")).toBeNull();
    });
  }

  it("an empty host gives notSignedIn before anything is stored", async () => {
    const { deps, invites } = inviteWorld();
    expect(await createInvite(deps, { host: "", sides: { mode: "random" }, platform: "web", now: INVITE_NOW })).toEqual(
      refused("notSignedIn"),
    );
    expect(await invites.find("CODE0001")).toBeNull();
  });

  for (const now of [-1, 1.5, Number.NaN, "1" as unknown as number]) {
    it(`a time of ${String(now)} gives invalidTime before anything is stored`, async () => {
      const { deps, invites } = inviteWorld();
      expect(await createInvite(deps, { host: HOST, sides: { mode: "random" }, platform: "web", now })).toEqual(
        refused("invalidTime"),
      );
      expect(await invites.find("CODE0001")).toBeNull();
    });
  }

  it("checks the host first, then the time, then the side mode", async () => {
    const { deps } = inviteWorld();
    const sides = { mode: "nope" } as unknown as SideMode;
    expect(await createInvite(deps, { host: "", sides, platform: "web", now: -1 })).toEqual(refused("notSignedIn"));
    expect(await createInvite(deps, { host: HOST, sides, platform: "web", now: -1 })).toEqual(refused("invalidTime"));
  });

  it("a code clash is retried with a new code, and the first invite is not overwritten", async () => {
    const { deps, invites, entitlements } = inviteWorld();
    await entitlements.grant("other-olga", { platform: "web", source: "test" });
    const clashing = { ...deps, code: sequence(["TAKEN", "TAKEN", "FREE"]) };
    await createInvite(clashing, { host: "other-olga", sides: { mode: "invitee" }, platform: "web", now: INVITE_NOW });
    const made = await createInvite(clashing, {
      host: HOST,
      sides: { mode: "random" },
      platform: "web",
      now: INVITE_NOW,
    });
    expect(made).toEqual({ ok: true, value: { code: "FREE" } });
    expect(await invites.find("TAKEN")).toMatchObject({ host: "other-olga", sides: { mode: "invitee" } });
  });

  it("a clash on all 3 tries gives storageFailed", async () => {
    const { deps, entitlements } = inviteWorld();
    await entitlements.grant("other-olga", { platform: "web", source: "test" });
    const codes: string[] = [];
    const clashing = { ...deps, code: () => (codes.push("TAKEN"), "TAKEN") };
    await createInvite(clashing, { host: "other-olga", sides: { mode: "invitee" }, platform: "web", now: INVITE_NOW });
    codes.length = 0;
    expect(
      await createInvite(clashing, { host: HOST, sides: { mode: "random" }, platform: "web", now: INVITE_NOW }),
    ).toEqual(refused("storageFailed"));
    expect(codes).toHaveLength(3);
  });

  it("a store failure gives storageFailed and does not throw", async () => {
    const { deps } = inviteWorld();
    const broken = { ...deps, invites: brokenStore() };
    expect(
      await createInvite(broken, { host: HOST, sides: { mode: "random" }, platform: "web", now: INVITE_NOW }),
    ).toEqual(refused("storageFailed"));
  });
});

describe("previewInvite refusals", () => {
  it("an unknown code gives inviteNotFound", async () => {
    const { deps } = inviteWorld();
    expect(await previewInvite(deps, "NOSUCHCD")).toEqual(refused("inviteNotFound"));
  });

  it("a store failure gives storageFailed and does not throw", async () => {
    const { deps } = inviteWorld();
    expect(await previewInvite({ ...deps, invites: brokenStore() }, "CODE0001")).toEqual(refused("storageFailed"));
  });
});

describe("joinInvite refusals", () => {
  const join = (deps: InviteDeps, code: string, extra: Partial<Parameters<typeof joinInvite>[1]> = {}) =>
    joinInvite(deps, { code, player: JOINER, now: INVITE_NOW + 1, ...extra });

  /** Asserts the refusal and that no match was stored. */
  async function expectRefused(result: Promise<InviteOutcome<unknown>>, code: string, world = inviteWorld()) {
    expect(await result).toEqual(refused(code));
    expect(world.matches.stored("match-1")).toBeNull();
  }

  it("an empty player gives notSignedIn", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "random" });
    await expectRefused(join(world.deps, code, { player: "" }), "notSignedIn", world);
  });

  it("a bad time gives invalidTime", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "random" });
    await expectRefused(join(world.deps, code, { now: -5 }), "invalidTime", world);
  });

  it("a side that is not lio or sae gives illegalSide", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "invitee" });
    await expectRefused(join(world.deps, code, { side: "both" as "lio" }), "illegalSide", world);
  });

  it("an unknown code gives inviteNotFound", async () => {
    const world = inviteWorld();
    await expectRefused(join(world.deps, "NOSUCHCD"), "inviteNotFound", world);
  });

  it("the host joining their own invite gives ownInvite", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "random" });
    await expectRefused(join(world.deps, code, { player: HOST }), "ownInvite", world);
  });

  it("an invitee-chooses invite without a side gives sideRequired", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "invitee" });
    await expectRefused(join(world.deps, code), "sideRequired", world);
  });

  for (const sides of [{ mode: "random" }, { mode: "host", hostSide: "sae" }] as SideMode[]) {
    it(`a side given for a ${sides.mode} invite gives sideNotChoosable`, async () => {
      const world = inviteWorld();
      const code = await codeFor(world.deps, sides);
      await expectRefused(join(world.deps, code, { side: "lio" }), "sideNotChoosable", world);
    });

    it(`a side of undefined for a ${sides.mode} invite counts as not given`, async () => {
      const world = inviteWorld();
      const code = await codeFor(world.deps, sides);
      expect(await join(world.deps, code, { side: undefined })).toMatchObject({ ok: true });
    });
  }

  it("a refusal from hostCreate comes back with its own code and stores nothing", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "random" });
    const noId = { ...world.deps, matchId: () => "" };
    expect(await join(noId, code)).toEqual(refused("invalidConfig"));
    expect(await previewInvite(world.deps, code)).toMatchObject({ ok: true });
  });

  it("a store failure gives storageFailed and does not throw", async () => {
    const world = inviteWorld();
    await expectRefused(join({ ...world.deps, invites: brokenStore() }, "CODE0001"), "storageFailed", world);
  });

  it("a failing generator gives storageFailed and does not throw", async () => {
    const world = inviteWorld();
    const code = await codeFor(world.deps, { mode: "random" });
    const failing = {
      ...world.deps,
      seed: () => {
        throw new Error("no randomness");
      },
    };
    await expectRefused(join(failing, code), "storageFailed", world);
  });

  describe("check order: the first failing check is the answer", () => {
    it("empty player before bad time", async () => {
      const world = inviteWorld();
      await expectRefused(join(world.deps, "NOSUCHCD", { player: "", now: -1 }), "notSignedIn", world);
    });
    it("bad time before a bad side", async () => {
      const world = inviteWorld();
      await expectRefused(join(world.deps, "NOSUCHCD", { now: -1, side: "x" as "lio" }), "invalidTime", world);
    });
    it("a bad side before an unknown code", async () => {
      const world = inviteWorld();
      await expectRefused(join(world.deps, "NOSUCHCD", { side: "x" as "lio" }), "illegalSide", world);
    });
    it("an unknown code before own invite", async () => {
      const world = inviteWorld();
      await expectRefused(join(world.deps, "NOSUCHCD", { player: HOST }), "inviteNotFound", world);
    });
    it("the host joining their own invitee-chooses invite without a side gets ownInvite", async () => {
      const world = inviteWorld();
      const code = await codeFor(world.deps, { mode: "invitee" });
      await expectRefused(join(world.deps, code, { player: HOST }), "ownInvite", world);
    });
    it("the host joining their own random invite with a side gets ownInvite", async () => {
      const world = inviteWorld();
      const code = await codeFor(world.deps, { mode: "random" });
      await expectRefused(join(world.deps, code, { player: HOST, side: "lio" }), "ownInvite", world);
    });
  });
});

describe("the invite functions never change their inputs", () => {
  it("frozen requests and side modes are accepted", async () => {
    const world = inviteWorld();
    const sides = Object.freeze({ mode: "host", hostSide: "lio" } as const);
    const made = await createInvite(
      world.deps,
      Object.freeze({ host: HOST, sides, platform: "web", now: INVITE_NOW } as const),
    );
    if (!made.ok) throw new Error(made.error.code);
    const request = Object.freeze({ code: made.value.code, player: JOINER, now: INVITE_NOW + 1 });
    expect(await joinInvite(world.deps, request)).toMatchObject({ ok: true });
    expect(sides).toEqual({ mode: "host", hostSide: "lio" });
  });
});
