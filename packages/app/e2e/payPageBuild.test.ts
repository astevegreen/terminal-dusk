// The pay page is part of the web build (#685): the server's checkout address points at /pay/, so a build without
// that page would send a buyer to nothing.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../vite.config.ts";

const file = (path: string): URL => new URL(`../${path}`, import.meta.url);

describe("the web build (#685)", () => {
  it("builds the pay page beside the app", () => {
    const input = config.build?.rolldownOptions?.input as Record<string, string>;
    expect(Object.keys(input).sort()).toEqual(["main", "pay"]);
    expect(input["main"]).toMatch(/[\\/]index\.html$/);
    expect(input["pay"]).toMatch(/[\\/]pay[\\/]index\.html$/);
    expect(existsSync(file("pay/index.html"))).toBe(true);
  });

  it("starts the pay page without the app", () => {
    const html = readFileSync(file("pay/index.html"), "utf8");
    expect(html).toContain('src="/src/platform/pay/payMain.ts"');
    expect(html).not.toContain("main.tsx");
  });

  it("leaves Paddle's script to the pay page: the app's page loads nothing of it", () => {
    expect(readFileSync(file("index.html"), "utf8")).not.toContain("paddle");
  });
});
