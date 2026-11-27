// @vitest-environment happy-dom
// The web purchases on screen (#685): the Full Game offer's buy button, and Restore purchase and Redeem a gift code on
// the offer and in the account area. The whole app, mounted in a stand-in page (happy-dom) against a fake server.
// Nothing leaves the test, and the payment page is never opened: the address the app would open is recorded.
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appGames } from "../appGames.ts";
import { EntitledApp } from "../entitlements/EntitledApp.tsx";
import { WEB_ROW, fakeEntitlements } from "../entitlements/test/fakeEntitlements.ts";
import type { OnlineSetup } from "../online/OnlineScreen.tsx";
import { SESSION_KEY } from "../online/signIn.ts";
import { STORED } from "../online/test/signInRig.ts";
import { memoryStore } from "../platform/storage.ts";
import { WEB_PURCHASE_NOTE, webPlatformPurchases } from "../platform/webPlatformPurchases.ts";
import { RETURN_DELAYS } from "../platform/webPurchaseReturn.ts";
import { fakeTimers } from "../transport/test/remoteGame.ts";
import { OFFER_BUY, OFFER_TEXT } from "../tutorial/FullGameOffer.tsx";
import { playUntil, pub } from "../tutorial/test/playTutorial.ts";
import type { TutorialSession } from "../tutorial/tutorialSession.ts";
import type { VsAiSession } from "../vsAi/session.ts";
import { playOut } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";

/** Every vs-AI session the screens have made, in order, and the opponent they play: the real sessions, a stand-in AI. */
const made = vi.hoisted((): VsAiSession[] => []);
const opponent = vi.hoisted((): { current: ReturnType<typeof standInAi> | null } => ({ current: null }));
vi.mock("../vsAi/session.ts", async () => {
  const actual = await vi.importActual<typeof import("../vsAi/session.ts")>("../vsAi/session.ts");
  return {
    createVsAiSession: (...args: Parameters<typeof actual.createVsAiSession>) => {
      const session = actual.createVsAiSession(...args);
      made.push(session);
      return session;
    },
  };
});
vi.mock("../vsAi/workerAi.ts", () => ({
  createWorkerAi: (...args: Parameters<ReturnType<typeof standInAi>["makeAi"]>) => opponent.current!.makeAi(...args),
}));
/** Every tutorial session the screen has made, in order; the sessions are the real ones. */
const lessons = vi.hoisted((): TutorialSession[] => []);
vi.mock("../tutorial/tutorialSession.ts", async () => {
  const actual = await vi.importActual<typeof import("../tutorial/tutorialSession.ts")>(
    "../tutorial/tutorialSession.ts",
  );
  return {
    createTutorialSession: (...args: Parameters<typeof actual.createTutorialSession>) => {
      const session = actual.createTutorialSession(...args);
      lessons.push(session);
      return session;
    },
  };
});

const ORIGIN = "https://app.test";
const CHECKOUT = `${ORIGIN}/pay/?_ptxn=txn_01h8abcDEF`;
const OWNS = { status: 200, body: [WEB_ROW] };
const CODE = "ABCDE-FGHIJ-KLMNP-QRSTU";
const clock = (): number => STORED.expiresAt - 3_600_000;
const newSeed = (): string => "s";
const newAiSeed = (): number => 1;

let screen: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  made.length = 0;
  lessons.length = 0;
  opponent.current = standInAi();
  screen = document.body.appendChild(document.createElement("div"));
  root = createRoot(screen);
});
afterEach(async () => {
  await act(async () => root.unmount());
  screen.remove();
  vi.unstubAllGlobals();
});

const settle = (): Promise<void> => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const button = (name: string): HTMLButtonElement | undefined =>
  [...screen.querySelectorAll("button")].find((b) => b.textContent === name);
async function press(name: string): Promise<void> {
  const found = button(name);
  expect(found, `a button named "${name}"`).toBeDefined();
  await act(async () => found!.click());
  await settle();
}
const giftField = (): HTMLInputElement | null => screen.querySelector('input[name="gift-code"]');
async function redeem(code: string): Promise<void> {
  const input = giftField()!;
  expect(input.closest("label")?.textContent).toContain("Redeem a gift code");
  input.value = code;
  await act(async () => input.form!.requestSubmit());
  await settle();
}
const alerts = (): string => [...screen.querySelectorAll('[role="alert"]')].map((a) => a.textContent).join("|");

async function mount({
  signedIn = true,
  sells = true,
  search = "",
  fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId }),
} = {}) {
  const store = memoryStore();
  if (signedIn) await store.set(SESSION_KEY, JSON.stringify(STORED));
  /** Every address the app opened instead of itself. */
  const opened: string[] = [];
  const timers = fakeTimers();
  const browser = {
    location: {
      href: `${ORIGIN}/${search}`,
      origin: ORIGIN,
      assign: (url: string | URL) => void opened.push(`${url}`),
    },
    history: { state: null, replaceState: () => {} },
  };
  const online: OnlineSetup = {
    auth: { url: "https://fake.supabase.test", anonKey: "fake-anon-key", fetch: fake.fetch },
    store,
    platform: "web",
    copy: () => {},
    ...(sells ? { purchases: webPlatformPurchases(browser, timers) } : {}),
  };
  await act(async () =>
    root.render(<EntitledApp clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} {...appGames} online={online} />),
  );
  await settle();
  return { fake, opened, timers };
}

/** Plays the free game to its end, where the Full Game offer is. */
async function reachOffer(): Promise<void> {
  await press("Play against the AI");
  await press("Play as LIO");
  await act(() => playOut(made[0]!, opponent.current!));
  await settle();
  expect(screen.textContent).toContain(OFFER_TEXT);
}

describe("the Full Game offer on the web (#685)", () => {
  it("has an enabled buy button that, tapped signed out, opens sign-in and not the payment page", async () => {
    const { fake, opened } = await mount({ signedIn: false });
    await reachOffer();
    expect(screen.textContent).toContain(WEB_PURCHASE_NOTE);
    expect(button(OFFER_BUY)!.disabled).toBe(false);
    await press(OFFER_BUY);
    expect(button("Send code")).toBeDefined();
    expect(fake.calls()).toEqual([]);
    expect(opened).toEqual([]);
  }, 60_000);

  it("buys, says a refusal in words, and disappears once Restore purchase finds a web entitlement", async () => {
    const { fake, opened } = await mount();
    await reachOffer();
    fake.answerCall({ status: 503, body: { ok: false, error: { code: "checkoutUnavailable", message: "x" } } });
    await press(OFFER_BUY);
    expect(alerts()).toContain("Buying isn't available right now. Try again later.");
    expect(opened).toEqual([]);
    fake.answerCall({ status: 200, body: { ok: true, url: CHECKOUT } });
    await press(OFFER_BUY);
    expect(opened).toEqual([CHECKOUT]);
    expect(giftField(), "the gift code field is on the offer").not.toBeNull();
    fake.answerNext(OWNS);
    await press("Restore purchase");
    expect(screen.textContent).not.toContain(OFFER_TEXT);
  }, 60_000);

  it("keeps its buy button disabled, with no sentence or controls, where the Platform sells nothing", async () => {
    await mount({ sells: false });
    await reachOffer();
    expect(button(OFFER_BUY)!.disabled).toBe(true);
    expect(screen.textContent).not.toContain(WEB_PURCHASE_NOTE);
    expect(button("Restore purchase")).toBeUndefined();
    expect(giftField()).toBeNull();
  }, 60_000);
});

describe("the Full Game offer at the tutorial's end, on the web (#685)", () => {
  /** Plays the tutorial's free game to its end, where the Full Game offer is. */
  async function finishTutorial(): Promise<void> {
    await press("Tutorial");
    await act(() => playUntil(lessons[0]!, (s) => pub(s).status.kind === "over"));
    await settle();
    expect(screen.textContent).toContain(OFFER_TEXT);
  }

  it("has an enabled buy button that, tapped signed out, opens sign-in", async () => {
    const { opened } = await mount({ signedIn: false });
    await finishTutorial();
    expect(screen.textContent).toContain(WEB_PURCHASE_NOTE);
    expect(button(OFFER_BUY)!.disabled).toBe(false);
    await press(OFFER_BUY);
    expect(button("Send code")).toBeDefined();
    expect(opened).toEqual([]);
  }, 60_000);

  it("buys, and disappears once Restore purchase finds a web entitlement", async () => {
    const { fake, opened } = await mount();
    await finishTutorial();
    fake.answerCall({ status: 200, body: { ok: true, url: CHECKOUT } });
    await press(OFFER_BUY);
    expect(opened).toEqual([CHECKOUT]);
    expect(giftField(), "the gift code field is on the offer").not.toBeNull();
    fake.answerNext(OWNS);
    await press("Restore purchase");
    expect(screen.textContent).not.toContain(OFFER_TEXT);
  }, 60_000);
});

describe("the account area (#685)", () => {
  const account = async (options: Parameters<typeof mount>[0] = {}) => {
    const rig = await mount(options);
    await press("Play online");
    return rig;
  };

  it("offers buying, with the sentence about other platforms, Restore purchase and the gift code field", async () => {
    const { fake, opened } = await account();
    expect(screen.textContent).toContain(WEB_PURCHASE_NOTE);
    expect(button("Restore purchase")).toBeDefined();
    expect(giftField()).not.toBeNull();
    fake.answerCall({ status: 200, body: { ok: true, url: CHECKOUT } });
    await press(OFFER_BUY);
    expect(opened).toEqual([CHECKOUT]);
  });

  it("is not there where the Platform sells nothing", async () => {
    await account({ sells: false });
    expect(button(OFFER_BUY)).toBeUndefined();
    expect(button("Restore purchase")).toBeUndefined();
  });

  it("says Restore purchase found nothing, and shows the game as owned once it is", async () => {
    const { fake } = await account();
    await press("Restore purchase");
    expect(screen.textContent).toContain("No purchase found on this account.");
    fake.answerNext(OWNS);
    await press("Restore purchase");
    expect(screen.textContent).toContain("Your Full Game is restored.");
    expect(screen.textContent).toContain("You own the Full Game.");
    expect(button(OFFER_BUY)).toBeUndefined();
  });

  it("stops saying the game is owned after a refund, once Restore purchase has read again", async () => {
    const fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId });
    fake.answerNext(OWNS);
    await account({ fake });
    expect(screen.textContent).toContain("You own the Full Game.");
    await press("Restore purchase");
    expect(screen.textContent).not.toContain("You own the Full Game.");
    expect(button(OFFER_BUY)).toBeDefined();
  });

  it("redeems a good gift code and shows the game as owned", async () => {
    const { fake } = await account();
    fake.answerCall({ status: 200, body: { ok: true, status: "redeemed", message: "x" } });
    fake.answerNext(OWNS);
    await redeem(CODE);
    expect(screen.textContent).toContain("Gift code redeemed.");
    expect(screen.textContent).toContain("You own the Full Game.");
    expect(giftField()!.value).toBe("");
  });

  it.each([
    [409, "codeUsed", "That gift code has already been used."],
    [404, "unknownCode", "No gift code matches that. Check it and try again."],
  ])("shows the refusal of a %i %s gift code in words and keeps what was typed", async (status, code, words) => {
    const { fake } = await account();
    fake.answerCall({ status, body: { ok: false, error: { code, message: "server words" } } });
    await redeem(CODE);
    expect(alerts()).toContain(words);
    expect(screen.textContent).not.toContain("server words");
    expect(giftField()!.value).toBe(CODE);
  });
});

describe("coming back from the payment page (#685)", () => {
  it("says it is looking for the purchase, then offers Restore purchase if it is still not there", async () => {
    const { fake, timers } = await mount({ search: "?purchase=done" });
    expect(screen.textContent).toContain("Looking for your new purchase…");
    for (let i = 0; i < RETURN_DELAYS.length; i++) {
      await act(async () => timers.fire());
      await settle();
    }
    expect(screen.textContent).toContain("your purchase is still being processed");
    fake.answerNext(OWNS);
    await press("Restore purchase");
    expect(screen.textContent).not.toContain("your purchase is still being processed");
  });

  it("says nothing once the purchase is there", async () => {
    const fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId });
    fake.answerNext(OWNS);
    fake.answerNext(OWNS);
    await mount({ search: "?purchase=done", fake });
    expect(screen.textContent).not.toContain("Looking for your new purchase…");
  });
});
