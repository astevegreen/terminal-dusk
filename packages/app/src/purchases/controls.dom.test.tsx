// @vitest-environment happy-dom
// The purchase controls on their own (#685): a signed-out player who presses Restore purchase or redeems a code is
// taken to sign-in, and a button waits while its request runs.
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseError } from "../platform/purchases.ts";
import type { PurchaseResult, Purchases } from "../platform/purchases.ts";
import { BuyButton, RestoreAndRedeem } from "./PurchaseControls.tsx";
import { PurchaseDeskContext } from "./desk.ts";

let screen: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  screen = document.body.appendChild(document.createElement("div"));
  root = createRoot(screen);
});
afterEach(async () => {
  await act(async () => root.unmount());
  screen.remove();
  vi.unstubAllGlobals();
});

async function show(purchases: Partial<Purchases>, controls: ReactNode) {
  const openSignIn = vi.fn();
  const desk = {
    purchases: { unlock: vi.fn(), restore: vi.fn(), ...purchases },
    note: "a note",
    owned: false,
    openSignIn,
  };
  await act(async () =>
    root.render(<PurchaseDeskContext.Provider value={desk}>{controls}</PurchaseDeskContext.Provider>),
  );
  return { openSignIn };
}
const settle = (): Promise<void> => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const button = (name: string): HTMLButtonElement | undefined =>
  [...screen.querySelectorAll("button")].find((b) => b.textContent === name);
const click = async (name: string): Promise<void> => {
  await act(async () => button(name)!.click());
  await settle();
};
const refuse = () => Promise.reject(new PurchaseError("notSignedIn"));

describe("the purchase controls (#685)", () => {
  it("takes a signed-out player who presses Restore purchase to sign-in", async () => {
    const { openSignIn } = await show({ restore: refuse }, <RestoreAndRedeem />);
    await click("Restore purchase");
    expect(openSignIn).toHaveBeenCalledOnce();
  });

  it("takes a signed-out player who redeems a code to sign-in", async () => {
    const { openSignIn } = await show({ redeemCode: refuse }, <RestoreAndRedeem />);
    screen.querySelector("input")!.value = "ABCDE";
    await act(async () => screen.querySelector("form")!.requestSubmit());
    await settle();
    expect(openSignIn).toHaveBeenCalledOnce();
  });

  it("leaves the gift code field out where the Platform takes no codes", async () => {
    await show({}, <RestoreAndRedeem />);
    expect(button("Restore purchase")).toBeDefined();
    expect(screen.querySelector("input")).toBeNull();
  });

  it("asks once however often the buy button is tapped while the answer is on its way", async () => {
    let answer: (result: PurchaseResult) => void = () => {};
    const unlock = vi.fn(() => new Promise<PurchaseResult>((resolve) => (answer = resolve)));
    await show({ unlock }, <BuyButton />);
    await click("Get the Full Game");
    await click("Get the Full Game");
    expect(unlock).toHaveBeenCalledOnce();
    expect(button("Get the Full Game")!.disabled).toBe(true);
    await act(async () => answer({ status: "refused", code: "network" }));
    expect(button("Get the Full Game")!.disabled).toBe(false);
    expect(screen.querySelector('[role="alert"]')!.textContent).toContain("Couldn't reach the server.");
  });

  it("says words, not an error, when a request fails in an unforeseen way", async () => {
    await show({ restore: () => Promise.reject(new TypeError("boom")) }, <RestoreAndRedeem />);
    await click("Restore purchase");
    expect(screen.textContent).toContain("Couldn't reach the server.");
    expect(screen.textContent).not.toContain("boom");
    expect(button("Restore purchase")!.disabled).toBe(false);
  });
});
