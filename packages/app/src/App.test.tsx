import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";

describe("App placeholder screen", () => {
  it("shows the game's name", () => {
    expect(renderToString(<App />)).toContain("Terminal Dusk");
  });
});
