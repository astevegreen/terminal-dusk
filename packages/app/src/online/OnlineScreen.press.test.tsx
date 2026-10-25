// Pressing the sign-in screen's buttons and submitting its forms without a browser: each calls the right thing.
import { describe, expect, it } from "vitest";
import { Home } from "../App.tsx";
import { SignInView } from "./SignInView.tsx";
import type { SignInActions } from "./SignInView.tsx";
import type { SignInSnapshot } from "./signIn.ts";
import { CODE, EMAIL } from "./test/signInRig.ts";
import { button, treeOf } from "./test/screenTree.ts";

type Call = [string, ...string[]];

function spy(): { actions: SignInActions; calls: Call[]; back: () => void } {
  const calls: Call[] = [];
  const actions: SignInActions = {
    sendCode: (email) => {
      calls.push(["sendCode", email]);
      return Promise.resolve();
    },
    enterCode: (code) => {
      calls.push(["enterCode", code]);
      return Promise.resolve();
    },
    resendCode: () => {
      calls.push(["resendCode"]);
      return Promise.resolve();
    },
    useOtherEmail: () => {
      calls.push(["useOtherEmail"]);
    },
    signOut: () => {
      calls.push(["signOut"]);
      return Promise.resolve();
    },
  };
  return { actions, calls, back: () => calls.push(["back"]) };
}

const idle = { busy: false, refusal: null } as const;
const EMAIL_STEP: SignInSnapshot = { kind: "email", ...idle };
const CODE_STEP: SignInSnapshot = { kind: "code", email: EMAIL, ...idle };
const SIGNED_IN: SignInSnapshot = { kind: "signedIn", userId: "user-0", ...idle };
const LOADING: SignInSnapshot = { kind: "loading", ...idle };

const drawn = (snapshot: SignInSnapshot, s: ReturnType<typeof spy>, setUp = true) =>
  treeOf(<SignInView snapshot={snapshot} actions={setUp ? s.actions : null} onBack={s.back} />);

describe("the email step", () => {
  it("Send code calls sendCode with the typed address", () => {
    const s = spy();
    const t = drawn(EMAIL_STEP, s);
    expect(button(t, "Send code").type).toBe("submit");
    expect(t.forms).toHaveLength(1);
    expect(t.forms[0]!.fields).toEqual(["email"]);
    t.forms[0]!.submit({ email: EMAIL });
    expect(s.calls).toEqual([["sendCode", EMAIL]]);
  });
  it("calls nothing when online play is not set up", () => {
    const s = spy();
    const t = drawn(EMAIL_STEP, s, false);
    t.forms[0]!.submit({ email: EMAIL });
    expect(s.calls).toEqual([]);
  });
});

describe("the code step", () => {
  it("Sign in calls enterCode with the typed code", () => {
    const s = spy();
    const t = drawn(CODE_STEP, s);
    expect(button(t, "Sign in").type).toBe("submit");
    expect(t.forms[0]!.fields).toEqual(["code"]);
    t.forms[0]!.submit({ code: CODE });
    expect(s.calls).toEqual([["enterCode", CODE]]);
  });
  it("Send a new code calls resendCode", () => {
    const s = spy();
    button(drawn(CODE_STEP, s), "Send a new code").press();
    expect(s.calls).toEqual([["resendCode"]]);
  });
  it("Use a different email calls useOtherEmail", () => {
    const s = spy();
    button(drawn(CODE_STEP, s), "Use a different email").press();
    expect(s.calls).toEqual([["useOtherEmail"]]);
  });
  it("the two extra buttons are plain buttons, so they do not submit the code", () => {
    const t = drawn(CODE_STEP, spy());
    expect(button(t, "Send a new code").type).toBe("button");
    expect(button(t, "Use a different email").type).toBe("button");
  });
});

describe("the signed-in step", () => {
  it("Sign out calls signOut", () => {
    const s = spy();
    button(drawn(SIGNED_IN, s), "Sign out").press();
    expect(s.calls).toEqual([["signOut"]]);
  });
});

describe("Back", () => {
  it("calls the home-screen callback from every state", () => {
    const states: [SignInSnapshot, boolean][] = [
      [LOADING, true],
      [EMAIL_STEP, true],
      [CODE_STEP, true],
      [SIGNED_IN, true],
      [EMAIL_STEP, false],
    ];
    for (const [snapshot, setUp] of states) {
      const s = spy();
      const back = button(drawn(snapshot, s, setUp), "Back");
      expect(back.type).toBe("button");
      back.press();
      expect(s.calls).toEqual([["back"]]);
    }
  });
});

describe("the home screen", () => {
  it("Play online opens the online screen; the other two still open theirs", () => {
    const picked: string[] = [];
    const t = treeOf(<Home onPick={(screen) => picked.push(screen)} />);
    for (const text of ["Play against the AI", "Play online", "Test mode"]) button(t, text).press();
    expect(picked).toEqual(["vsAi", "online", "testMode"]);
  });
});
