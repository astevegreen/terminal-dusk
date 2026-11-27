// @vitest-environment happy-dom
// The web app's start (main.tsx) hands the app the web purchases (#685), and none in a build with no online play.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnlineSetup } from "../online/OnlineScreen.tsx";

const mounted = vi.hoisted((): (OnlineSetup | undefined)[] => []);
vi.mock("../appRoot.tsx", () => ({
  mountApp: (_sounds: unknown, online?: OnlineSetup) => void mounted.push(online),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  mounted.length = 0;
});

describe("the web app's start (#685)", () => {
  it("hands the app the web purchases", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://fake.supabase.test");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fake-anon-key");
    await import("../main.tsx");
    expect(mounted[0]?.purchases).toBeTypeOf("function");
  });

  it("starts with no online play, and so nothing to buy, without the Supabase settings", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    await import("../main.tsx");
    expect(mounted).toEqual([undefined]);
  });
});
