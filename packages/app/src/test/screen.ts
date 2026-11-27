// A stand-in page (happy-dom) for a test that mounts a screen: a new React root for each test, and the taps a test
// makes on it. The test file names happy-dom as its environment.
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, vi } from "vitest";

/** Waits for the work already queued, and for what React then draws. */
export const settle = (): Promise<void> => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** Call once, at the top of a test file: `screen` is empty until `render`, and is emptied again after each test. */
export function testScreen() {
  const screen = document.createElement("div");
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.appendChild(screen);
    root = createRoot(screen);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    screen.remove();
    vi.unstubAllGlobals();
  });
  const render = (node: ReactNode): Promise<void> => act(async () => root.render(node));
  const button = (name: string): HTMLButtonElement | undefined =>
    [...screen.querySelectorAll("button")].find((b) => b.textContent === name);
  /** Taps the button with this text, which must be there, and waits for what follows. */
  const press = async (name: string): Promise<void> => {
    const found = button(name);
    expect(found, `a button named "${name}"`).toBeDefined();
    await act(async () => found!.click());
    await settle();
  };
  return { screen, render, button, press };
}
