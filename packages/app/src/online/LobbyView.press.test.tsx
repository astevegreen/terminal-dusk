// Pressing the lobby screen's buttons, typing in its code field and submitting its form without a browser: each
// calls the right lobby session method.
import { describe, expect, it } from "vitest";
import type { LobbySnapshot } from "./lobbySession.ts";
import { DEFAULT_DEADLINE, DEFAULT_SIDES } from "./lobbySession.ts";
import { LobbyView } from "./LobbyView.tsx";
import type { LobbyActions } from "./LobbyView.tsx";
import { game } from "./test/lobbyRig.ts";
import { button, treeOf } from "./test/screenTree.ts";

type Call = [string, ...unknown[]];

function spy(): { actions: LobbyActions; calls: Call[]; signOut: () => void; back: () => void } {
  const calls: Call[] = [];
  const done = (...call: Call): Promise<void> => {
    calls.push(call);
    return Promise.resolve();
  };
  const actions: LobbyActions = {
    chooseSides: (sides) => void calls.push(["chooseSides", sides]),
    chooseDays: (days) => void calls.push(["chooseDays", days]),
    chooseRule: (rule) => void calls.push(["chooseRule", rule]),
    create: () => done("create"),
    copyCode: () => done("copyCode"),
    join: (code) => done("join", code),
    pickSide: (side) => done("pickSide", side),
    codeChanged: () => void calls.push(["codeChanged"]),
    refresh: () => done("refresh"),
  };
  return { actions, calls, signOut: () => calls.push(["signOut"]), back: () => calls.push(["back"]) };
}

const BASE: LobbySnapshot = {
  sides: DEFAULT_SIDES,
  deadline: DEFAULT_DEADLINE,
  create: { busy: false, code: null, refusal: null },
  join: { busy: false, askSide: null, joined: null, refusal: null },
  games: { busy: false, list: [game()], refusal: null },
};
const WITH_CODE: LobbySnapshot = { ...BASE, create: { ...BASE.create, code: "ABC123" } };
const ASKING: LobbySnapshot = { ...BASE, join: { ...BASE.join, askSide: "ABC123" } };

const drawn = (snapshot: LobbySnapshot, s: ReturnType<typeof spy>) =>
  treeOf(<LobbyView snapshot={snapshot} actions={s.actions} onSignOut={s.signOut} onBack={s.back} />);

const pressed = (snapshot: LobbySnapshot, text: string): Call[] => {
  const s = spy();
  const b = button(drawn(snapshot, s), text);
  expect(b.type).toBe("button");
  b.press();
  return s.calls;
};

describe("New game", () => {
  it("each side choice calls chooseSides with its mode", () => {
    expect(pressed(BASE, "Random sides")).toEqual([["chooseSides", { mode: "random" }]]);
    expect(pressed(BASE, "I play LIO")).toEqual([["chooseSides", { mode: "host", hostSide: "lio" }]]);
    expect(pressed(BASE, "I play SAE")).toEqual([["chooseSides", { mode: "host", hostSide: "sae" }]]);
    expect(pressed(BASE, "My friend picks")).toEqual([["chooseSides", { mode: "invitee" }]]);
  });
  it("each length calls chooseDays and each rule calls chooseRule", () => {
    expect(pressed(BASE, "1 day")).toEqual([["chooseDays", 1]]);
    expect(pressed(BASE, "3 days")).toEqual([["chooseDays", 3]]);
    expect(pressed(BASE, "7 days")).toEqual([["chooseDays", 7]]);
    expect(pressed(BASE, "Loss on time")).toEqual([["chooseRule", "lossOnTime"]]);
    expect(pressed(BASE, "One extra deadline, then loss on time")).toEqual([["chooseRule", "graceThenLoss"]]);
  });
  it("Create game calls create", () => {
    expect(pressed(BASE, "Create game")).toEqual([["create"]]);
  });
  it("Copy calls copyCode", () => {
    expect(pressed(WITH_CODE, "Copy")).toEqual([["copyCode"]]);
  });
});

describe("Join a game", () => {
  it("submitting the form calls join with the typed code", () => {
    const s = spy();
    const t = drawn(BASE, s);
    expect(button(t, "Join").type).toBe("submit");
    expect(t.forms).toHaveLength(1);
    expect(t.forms[0]!.fields).toEqual(["code"]);
    t.forms[0]!.submit({ code: "abc123" });
    expect(s.calls).toEqual([["join", "abc123"]]);
  });
  it("typing in the code field calls codeChanged", () => {
    const s = spy();
    drawn(ASKING, s)
      .inputs.find((i) => i.name === "code")!
      .change();
    expect(s.calls).toEqual([["codeChanged"]]);
  });
  it("Play LIO and Play SAE call pickSide", () => {
    expect(pressed(ASKING, "Play LIO")).toEqual([["pickSide", "lio"]]);
    expect(pressed(ASKING, "Play SAE")).toEqual([["pickSide", "sae"]]);
  });
  it("disables the field, Join and the side buttons while a join is in flight", () => {
    const t = drawn({ ...ASKING, join: { ...ASKING.join, busy: true } }, spy());
    for (const text of ["Join", "Play LIO", "Play SAE"]) expect(button(t, text).disabled).toBe(true);
    expect(t.inputs.find((i) => i.name === "code")?.disabled).toBe(true);
  });
});

describe("My games, Sign out and Back", () => {
  it("Refresh calls refresh", () => {
    expect(pressed(BASE, "Refresh")).toEqual([["refresh"]]);
  });
  it("Refresh is off while a read is in flight", () => {
    const t = drawn({ ...BASE, games: { ...BASE.games, busy: true } }, spy());
    expect(button(t, "Refresh").disabled).toBe(true);
  });
  it("Sign out and Back call their callbacks", () => {
    expect(pressed(BASE, "Sign out")).toEqual([["signOut"]]);
    expect(pressed(BASE, "Back")).toEqual([["back"]]);
  });
});
