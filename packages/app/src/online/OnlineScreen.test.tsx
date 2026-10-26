import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import type { AuthRefusal } from "../transport/emailAuth.ts";
import { AUTH_ANON_KEY, AUTH_URL } from "../transport/test/fakeAuth.ts";
import { fakeTimers } from "../transport/test/remoteGame.ts";
import { memoryStore } from "../platform/storage.ts";
import { OnlineScreen } from "./OnlineScreen.tsx";
import { NOT_SET_UP, REFUSAL_MESSAGE, SignInView } from "./SignInView.tsx";
import type { SignIn } from "./signIn.ts";
import { CODE, EMAIL, STORED, rig, rigOnCode, rigWith, settle } from "./test/signInRig.ts";
import type { Rig } from "./test/signInRig.ts";
import { button, treeOf } from "./test/screenTree.ts";

const page = (signIn: SignIn): string =>
  renderToString(<SignInView snapshot={signIn.getSnapshot()} actions={signIn} onBack={() => {}} />);
const tree = (signIn: SignIn) =>
  treeOf(<SignInView snapshot={signIn.getSnapshot()} actions={signIn} onBack={() => {}} />);
const tapSized = (out: string, text: string): void =>
  expect(out).toMatch(new RegExp(`<button[^>]*min-width:44px[^>]*>${text}</button>`));
/** The <input> tag inside the <label> that starts with `text`; fails the test when there is none. */
function labelledInput(out: string, text: string): string {
  const match = new RegExp(`<label>${text}(?:<!-- -->)? (<input[^>]*>)</label>`).exec(out);
  expect(match, `a field labelled "${text}"`).not.toBeNull();
  return match![1]!;
}
const onEmail = async (): Promise<Rig> => {
  const r = rig();
  await r.signIn.start();
  return r;
};

describe("the way in from the home screen", () => {
  it("has a 44 px Play online button next to Play against the AI and Test mode", () => {
    const out = renderToString(<App clock={() => 0} newSeed={() => "s"} newAiSeed={() => 1} />);
    for (const text of ["Play against the AI", "Play online", "Test mode"]) tapSized(out, text);
  });
});

describe("the email step", () => {
  it("has a labelled email field and a 44 px Send code button, both enabled", async () => {
    const r = await onEmail();
    const out = page(r.signIn);
    const field = labelledInput(out, "Email address");
    for (const attr of ['type="email"', 'name="email"', 'autoComplete="email"']) expect(field).toContain(attr);
    tapSized(out, "Send code");
    expect(button(tree(r.signIn), "Send code").disabled).toBe(false);
    expect(out).not.toContain(NOT_SET_UP);
  });
  it("disables Send code while the code is being asked for", async () => {
    const r = await onEmail();
    const release = r.fake.hold();
    const sending = r.signIn.sendCode(EMAIL);
    expect(r.signIn.getSnapshot().busy).toBe(true);
    expect(button(tree(r.signIn), "Send code").disabled).toBe(true);
    expect(page(r.signIn)).toMatch(/<input type="email"[^>]* disabled=""/);
    release();
    await sending;
  });
});

describe("the code step", () => {
  it("names the address and has a numeric one-time-code field and three 44 px buttons", async () => {
    const r = await rigOnCode();
    const out = page(r.signIn);
    expect(out).toContain(`We sent a 6-digit code to ${EMAIL}.`);
    const field = labelledInput(out, "Code");
    for (const attr of ['name="code"', 'inputMode="numeric"', 'autoComplete="one-time-code"'])
      expect(field).toContain(attr);
    for (const text of ["Sign in", "Send a new code", "Use a different email"]) tapSized(out, text);
  });
  it("disables its buttons while the code is being checked", async () => {
    const r = await rigOnCode();
    const release = r.fake.hold();
    const checking = r.signIn.enterCode(CODE);
    const t = tree(r.signIn);
    for (const text of ["Sign in", "Send a new code", "Use a different email"])
      expect(button(t, text).disabled).toBe(true);
    expect(button(t, "Back").disabled).toBe(false);
    release();
    await checking;
  });
});

describe("the signed-in step", () => {
  it("shows Signed in and a 44 px Sign out button", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    const out = page(r.signIn);
    expect(out).toContain("Signed in");
    tapSized(out, "Sign out");
  });
  it("goes back to the email step on Sign out", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    button(tree(r.signIn), "Sign out").press();
    await settle();
    expect(r.signIn.getSnapshot().kind).toBe("email");
    expect(page(r.signIn)).toContain('name="email"');
  });
});

describe("each refusal", () => {
  const cases: [AuthRefusal, () => Promise<Rig>][] = [
    [
      "badEmail",
      async () => {
        const r = await onEmail();
        await r.signIn.sendCode("not an email");
        return r;
      },
    ],
    [
      "badCode",
      async () => {
        const r = await rigOnCode();
        await r.signIn.enterCode("12");
        return r;
      },
    ],
    [
      "wrongCode",
      async () => {
        const r = await rigOnCode();
        r.fake.answerNext({ status: 403, body: { msg: "Token has expired or is invalid" } });
        await r.signIn.enterCode(CODE);
        return r;
      },
    ],
    [
      "tooManyRequests",
      async () => {
        const r = await onEmail();
        r.fake.answerNext({ status: 429, body: {} });
        await r.signIn.sendCode(EMAIL);
        return r;
      },
    ],
    [
      "network",
      async () => {
        const r = await rigOnCode();
        r.fake.answerNext("throw");
        await r.signIn.resendCode();
        return r;
      },
    ],
  ];
  for (const [refusal, reach] of cases) {
    it(`shows its own plain message for ${refusal}, announced to screen readers`, async () => {
      const r = await reach();
      expect(r.signIn.getSnapshot().refusal).toBe(refusal);
      expect(page(r.signIn)).toContain(`<p role="alert">${REFUSAL_MESSAGE[refusal]}</p>`);
    });
  }
  it("has five different messages", () => {
    expect(new Set(Object.values(REFUSAL_MESSAGE)).size).toBe(5);
  });
});

describe("every state has a way home", () => {
  it("shows a 44 px Back button when loading, on email, on code, signed in and not set up", async () => {
    const loading = rig();
    const email = await onEmail();
    const code = await rigOnCode();
    const signedIn = await rigWith(STORED);
    await signedIn.signIn.start();
    const kinds = [loading, email, code, signedIn].map((r) => r.signIn.getSnapshot().kind);
    expect(kinds).toEqual(["loading", "email", "code", "signedIn"]);
    const pages = [loading, email, code, signedIn].map((r) => page(r.signIn));
    pages.push(renderToString(<OnlineScreen clock={() => 0} timers={fakeTimers()} onBack={() => {}} />));
    for (const out of pages) tapSized(out, "Back");
  });
});

describe("a build with no online play set up", () => {
  it("shows the email step with Send code disabled and the not-set-up line", () => {
    const screen = <OnlineScreen clock={() => 0} timers={fakeTimers()} onBack={() => {}} />;
    const out = renderToString(screen);
    expect(out).toContain('name="email"');
    expect(out).toContain(`<p>${NOT_SET_UP}</p>`);
    expect(button(treeOf(screen), "Send code").disabled).toBe(true);
  });
  it("shows the loading step before the stored session is read when it is set up", () => {
    const online = {
      auth: { url: AUTH_URL, anonKey: AUTH_ANON_KEY, fetch: rig().fake.fetch },
      store: memoryStore(),
      platform: "web" as const,
      copy: () => {},
    };
    const out = renderToString(
      <OnlineScreen online={online} clock={() => 0} timers={fakeTimers()} onBack={() => {}} />,
    );
    expect(out).toContain("Loading");
    expect(out).not.toContain(NOT_SET_UP);
  });
});

describe("secrets", () => {
  it("never renders the code or a token, at any step of signing in and out", async () => {
    const r = await onEmail();
    const pages: string[] = [page(r.signIn)];
    r.signIn.subscribe(() => pages.push(page(r.signIn)));
    await r.signIn.sendCode(EMAIL);
    r.fake.answerNext({ status: 403, body: {} });
    await r.signIn.enterCode("654321");
    await r.signIn.enterCode(CODE);
    await r.signIn.signOut();
    const stored = await rigWith(STORED);
    await stored.signIn.start();
    pages.push(page(stored.signIn));
    expect(pages.length).toBeGreaterThan(5);
    for (const out of pages)
      for (const secret of [CODE, "654321", "access-1", "refresh-1", STORED.accessToken, STORED.refreshToken])
        expect(out).not.toContain(secret);
  });
});
