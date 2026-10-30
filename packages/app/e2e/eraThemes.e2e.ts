// The era themes (#481), run at both configured sizes (844x390 and 1280x800): a whole first-deck game against the AI
// starts in the green-screen terminal of Era 1, turns into the news desk when Era 2 starts and into the data
// dashboard when Era 3 starts, and stays there for the future cards. Each theme's stylesheet really reaches the
// screen, and the layout is the same in every era: the top bar and the hand strip keep their size. A screenshot of
// each theme at each size is saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";

/** Each theme's furniture background, as its stylesheet in src/game/themes/ sets it. */
const BACKGROUND: Readonly<Record<string, string>> = {
  terminal: "#050a05",
  newsDesk: "#06163a",
  dashboard: "#15181d",
};

type Seen = { theme: string; background: string; top: number; strip: number };

async function look(page: Page): Promise<Seen> {
  return page.locator(".game").evaluate((el) => ({
    theme: el.getAttribute("data-theme") ?? "",
    background: getComputedStyle(el).getPropertyValue("--game-bg").trim(),
    top: el.querySelector(".game-top")!.getBoundingClientRect().height,
    strip: el.querySelector(".game-strip")!.getBoundingClientRect().height,
  }));
}

async function shoot(page: Page, testInfo: TestInfo, theme: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l4-${theme}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${theme} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}

test("each era wears its own theme: the terminal, then the news desk, then the dashboard, with the same layout", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the AI" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();

  const order: Seen[] = [];
  const gameOver = page.getByText("Game over");
  for (let step = 0; step < 100; step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    const seen = await look(page);
    if (order.at(-1)?.theme !== seen.theme) {
      order.push(seen);
      await shoot(page, testInfo, seen.theme);
    }
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();

  expect(order.map((s) => s.theme)).toEqual(["terminal", "newsDesk", "dashboard"]);
  for (const seen of order) expect(seen.background, seen.theme).toBe(BACKGROUND[seen.theme]);
  for (const seen of order.slice(1)) {
    expect(seen.top, `${seen.theme} top bar`).toBeCloseTo(order[0]!.top, 0);
    expect(seen.strip, `${seen.theme} hand strip`).toBeCloseTo(order[0]!.strip, 0);
  }
});
