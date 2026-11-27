// The pay page (#685, Decision (architect) on the issue): it starts Paddle's checkout in test mode with the public
// client token, sends a finished payment back to the app, and says in words when payment can't be offered.
import { describe, expect, it } from "vitest";
import { PAY_NOTHING, PAY_UNAVAILABLE, startPayPage } from "./payPage.ts";
import type { PaddleApi, PaddleOptions } from "./payPage.ts";

function page({ token = "test_clienttoken", environment = "sandbox", search = "?_ptxn=txn_01h8abc" } = {}) {
  const calls: string[] = [];
  const started: PaddleOptions[] = [];
  const paddle: PaddleApi = {
    Environment: { set: (name) => void calls.push(`environment ${name}`) },
    Initialize: (options) => {
      calls.push("initialize");
      started.push(options);
    },
  };
  const went: string[] = [];
  const said: string[] = [];
  let loads = 0;
  const deps = {
    token,
    environment,
    search,
    origin: "https://app.test",
    loadPaddle: () => {
      loads++;
      return Promise.resolve(paddle);
    },
    go: (url: string) => void went.push(url),
    say: (words: string) => void said.push(words),
  };
  return { deps, calls, started, went, said, loads: () => loads };
}

describe("the pay page (#685)", () => {
  it("starts Paddle in test mode with the client token and a success address back to the app", async () => {
    const p = page();
    await startPayPage(p.deps);
    expect(p.calls).toEqual(["environment sandbox", "initialize"]);
    expect(p.started[0]!.token).toBe("test_clienttoken");
    expect(p.started[0]!.checkout.settings.successUrl).toBe("https://app.test/?purchase=done");
    expect(p.said).toEqual([]);
  });

  it("uses Paddle's live checkout only when the build does not ask for the sandbox", async () => {
    const p = page({ environment: "" });
    await startPayPage(p.deps);
    expect(p.calls).toEqual(["initialize"]);
  });

  it("goes back to the app when the checkout is closed unfinished", async () => {
    const p = page();
    await startPayPage(p.deps);
    p.started[0]!.eventCallback({ name: "checkout.loaded" });
    expect(p.went).toEqual([]);
    p.started[0]!.eventCallback({ name: "checkout.closed" });
    expect(p.went).toEqual(["/"]);
  });

  it("goes back as a finished purchase when the checkout is closed after paying", async () => {
    const p = page();
    await startPayPage(p.deps);
    p.started[0]!.eventCallback({ name: "checkout.completed" });
    p.started[0]!.eventCallback({ name: "checkout.closed" });
    expect(p.went).toEqual(["https://app.test/?purchase=done"]);
  });

  it("says payment is unavailable, loading nothing from Paddle, when the build has no client token", async () => {
    const p = page({ token: "" });
    await startPayPage(p.deps);
    expect(p.said).toEqual([PAY_UNAVAILABLE]);
    expect(p.loads()).toBe(0);
  });

  it("says there is nothing to pay for, loading nothing from Paddle, without a transaction in the address", async () => {
    const p = page({ search: "" });
    await startPayPage(p.deps);
    expect(p.said).toEqual([PAY_NOTHING]);
    expect(p.loads()).toBe(0);
  });

  it("says payment is unavailable when Paddle's script can't be loaded", async () => {
    const p = page();
    await startPayPage({ ...p.deps, loadPaddle: () => Promise.reject(new Error("blocked")) });
    expect(p.said).toEqual([PAY_UNAVAILABLE]);
  });
});
