// The ticker and the log drawer (L9, #489): the ticker shows the newest log line exactly as the log has it, and
// opens the full log, newest first, in a drawer that starts closed. Opening and closing in a browser are in
// e2e/ticker.e2e.ts; when it shows and how it closes are in drawerControl.test.ts.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonsOf } from "../testMode/promptTree.ts";
import { LogDrawer } from "./logDrawer.tsx";

const tickerOf = (html: string): string => /<button[^>]*class="game-ticker"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
const drawerOf = (html: string): string => /<div[^>]*class="game-drawer"[^>]*>/.exec(html)?.[0] ?? "";

describe("the ticker", () => {
  const out = renderToString(
    <LogDrawer log={["LIO placed 1 influence in poland for 1 point.", "SAE spent 2 points."]} waitingId="d1" />,
  );
  it("shows the newest log line, word for word, and no other", () => {
    expect(tickerOf(out)).toContain('<span class="game-ticker-line">SAE spent 2 points.</span>');
    expect(tickerOf(out)).not.toContain("poland");
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
    const html = renderToString(<LogDrawer log={['<b>"x"</b> & y']} waitingId={null} />);
    expect(tickerOf(html)).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y");
  });
  it("says nothing has happened yet before the first log line", () => {
    expect(tickerOf(renderToString(<LogDrawer log={[]} waitingId={null} />))).toContain("Nothing has happened yet");
  });
});

describe("the log drawer", () => {
  const out = renderToString(<LogDrawer log={["first", "second"]} waitingId={null} />);
  it("starts closed: hidden, beside the ticker, named Game log", () => {
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
  it("is a memo element, so the test walkers step over its hooks and its buttons", () => {
    expect(buttonsOf(<LogDrawer log={["first"]} waitingId={null} />)).toEqual([]);
  });
});
