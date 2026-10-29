// The top bar's ticker and the log drawer (L9, #489): the ticker, the top bar's last item, shows the newest log line
// exactly as the log has it, and opens the full log, newest first, in a drawer that starts closed. Opening and
// closing in a browser are in e2e/ticker.e2e.ts; when it shows and how it closes are in drawerControl.test.ts.
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonsOf } from "../testMode/promptTree.ts";
import { TopBar } from "./topBar.tsx";

const tickerOf = (html: string): string => /<button[^>]*class="game-ticker"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
const drawerOf = (html: string): string => /<div[^>]*class="game-drawer"[^>]*>/.exec(html)?.[0] ?? "";
const bar = (log: string[], waitingId: string | null = null, items: ReactNode = <p>Status</p>): string =>
  renderToString(
    <TopBar log={log} waitingId={waitingId}>
      {items}
    </TopBar>,
  );

describe("the ticker", () => {
  const out = bar(["LIO placed 1 influence in Poland for 1 point.", "SAE spent 2 points."], "d1");
  it("is the top bar's last item, after the bar's other items", () => {
    expect(out).toMatch(/^<div class="game-top"><p>Status<\/p><button[^>]*class="game-ticker"[^]*?<\/button><\/div>/);
  });
  it("shows the newest log line, word for word, and no other", () => {
    expect(tickerOf(out)).toContain('<span class="game-ticker-line">SAE spent 2 points.</span>');
    expect(tickerOf(out)).not.toContain("Poland");
  });
  it("is a button that says the drawer is closed and names the drawer it opens", () => {
    const ticker = tickerOf(out);
    expect(ticker).toContain('type="button"');
    expect(ticker).toContain('aria-expanded="false"');
    const controls = /aria-controls="([^"]+)"/.exec(ticker)?.[1];
    expect(controls).toBeDefined();
    expect(drawerOf(out)).toContain(`id="${controls}"`);
  });
  it("shows the line as text, so nothing in it is read as markup", () => {
    expect(tickerOf(bar(['<b>"x"</b> & y']))).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y");
  });
  it("says nothing has happened yet before the first log line", () => {
    expect(tickerOf(bar([]))).toContain("Nothing has happened yet");
  });
});

describe("the log drawer", () => {
  const out = bar(["first", "second"]);
  it("starts closed: hidden, after the top bar, named Game log", () => {
    const drawer = drawerOf(out);
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('aria-label="Game log"');
    expect(drawer).toMatch(/\shidden=""/);
    expect(out.indexOf("game-ticker")).toBeLessThan(out.indexOf("game-drawer"));
  });
  it("holds the whole log as role=log, newest first, and a Close button", () => {
    expect(out).toContain('<section aria-label="Log" data-testid="log" class="game-log" role="log">');
    expect(out).toContain('<ol aria-label="Log entries" tabindex="0"><li>second</li><li>first</li></ol>');
    expect(out).toMatch(/<button type="button"[^>]*>Close<\/button>/);
  });
});

describe("pinning the log (L10, #490)", () => {
  const out = bar(["first"]);
  it("offers Pin after Close, hidden until the screen is large (a server render is never large)", () => {
    const head = /<div class="game-drawer-head">[^]*?<\/div>/.exec(out)?.[0] ?? "";
    expect(head).toMatch(/>Close<\/button><button type="button"[^>]*class="game-drawer-pin"[^>]*>Pin<\/button>/);
    expect(/<button[^>]*class="game-drawer-pin"[^>]*>/.exec(head)?.[0]).toMatch(/aria-pressed="false"[^>]*hidden=""/);
  });
  it("starts unpinned", () => {
    expect(drawerOf(out)).toContain('data-pinned="false"');
  });
});

const detailsButtonOf = (html: string): string =>
  /<button[^>]*class="game-details-button"[^>]*>[^<]*<\/button>/.exec(html)?.[0] ?? "";
const panelOf = (html: string): string => /<div[^>]*class="game-drawer game-details"[^>]*>[^]*$/.exec(html)?.[0] ?? "";

describe("the Details panel (L10, #490)", () => {
  const out = renderToString(
    <TopBar log={["first"]} waitingId="d1" details={<p>The rival holds 7 cards</p>}>
      <p>Status</p>
    </TopBar>,
  );
  it("is opened by a Details button in the top bar, just before the ticker, which stays last", () => {
    expect(out).toMatch(
      /^<div class="game-top"><p>Status<\/p><button[^>]*class="game-details-button"[^>]*>Details<\/button><button[^>]*class="game-ticker"[^]*?<\/button><\/div>/,
    );
  });
  it("names the panel it opens, which starts closed: hidden, after the top bar, named Game details", () => {
    const button = detailsButtonOf(out);
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-expanded="false"');
    const controls = /aria-controls="([^"]+)"/.exec(button)?.[1];
    const panel = /<div[^>]*class="game-drawer game-details"[^>]*>/.exec(out)?.[0] ?? "";
    expect(panel).toContain(`id="${controls}"`);
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-label="Game details"');
    expect(panel).toMatch(/\shidden=""/);
    expect(out.indexOf("game-details-button")).toBeLessThan(out.indexOf('class="game-drawer game-details"'));
  });
  it("holds what the page gives it, under a Close button", () => {
    const panel = panelOf(out);
    expect(panel).toMatch(/<div class="game-drawer-head">[^]*?>Close<\/button><\/div>/);
    expect(panel).toContain("<p>The rival holds 7 cards</p>");
  });
  it("is left out when the page gives no details", () => {
    expect(detailsButtonOf(bar(["first"]))).toBe("");
    expect(bar(["first"])).not.toContain("game-details");
  });
});

describe("the test walkers", () => {
  it("step over its hooks, the ticker and Close, and still reach the page's own buttons in the bar", () => {
    const pressed: string[] = [];
    const items = (
      <button type="button" onClick={() => pressed.push("back")}>
        Back
      </button>
    );
    const buttons = buttonsOf(
      <TopBar log={["first"]} waitingId={null}>
        {items}
      </TopBar>,
    );
    expect(buttons.map((b) => b.text)).toEqual(["Back"]);
    buttons[0]?.click();
    expect(pressed).toEqual(["back"]);
  });
});
