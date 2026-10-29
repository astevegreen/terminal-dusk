// The game screen laid out for a phone held sideways (L1, #464), run at both configured sizes (844x390 and
// 1280x800): no page scroll, a thin top bar, the map filling the main area, and one side panel whose tabs switch
// between Play, Log and Details. A screenshot of each size is saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { pageSize, startSixRegionGame } from "./start.ts";

const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el) => el.getBoundingClientRect().toJSON());
const tab = (page: Page, name: string): Locator => page.getByRole("tab", { name, exact: true });

async function expectNoPageScroll(page: Page): Promise<void> {
  const viewport = page.viewportSize()!;
  const size = await pageSize(page);
  expect(size.height).toBeLessThanOrEqual(viewport.height);
  expect(size.width).toBeLessThanOrEqual(viewport.width);
}

test("the six-region game fits the screen: no page scroll, the status bar, map and decision all on screen", async ({
  page,
}, testInfo) => {
  const map = await startSixRegionGame(page);
  const viewport = page.viewportSize()!;
  await expectNoPageScroll(page);
  await expect(page.getByTestId("status-bar")).toBeInViewport({ ratio: 1 });
  await expect(map).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("decision")).toBeInViewport();
  await expect(page.getByTestId("decision").getByRole("button").first()).toBeInViewport({ ratio: 1 });
  // Held sideways, the turn-your-phone hint stays out of the way.
  await expect(page.getByText("Turn your phone sideways to play.")).toBeHidden();

  // A thin top bar holds the status, the score track and Escalation; the map fills the main area beside the panel.
  const top = await box(page.locator(".game-top"));
  await expect(page.locator(".game-top").getByTestId("tracks")).toBeVisible();
  expect(top.height).toBeLessThanOrEqual(viewport.height * 0.2);
  const mapBox = await box(map);
  const side = await box(page.getByRole("region", { name: "Game details" }));
  expect(mapBox.top).toBeGreaterThanOrEqual(top.bottom);
  expect(mapBox.height).toBeGreaterThanOrEqual(viewport.height * 0.55);
  expect(mapBox.width).toBeGreaterThan(side.width);
  expect(side.left).toBeGreaterThanOrEqual(mapBox.right);
  expect(side.bottom).toBeLessThanOrEqual(viewport.height);

  // Every button on screen, the tabs included, is at least a tap target tall.
  const heights = await page
    .locator("button:visible")
    .evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  const path = testInfo.outputPath(`l1-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`layout ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
});

test("the side panel's tabs switch between Play, Log and Details, and Play opens by itself on a new decision", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  const decision = page.getByTestId("decision");
  await expect(decision).toBeVisible();
  await expect(tab(page, "Play")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("hand")).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();

  await tab(page, "Log").click();
  await expect(tab(page, "Log")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("log")).toBeVisible();
  await expect(decision).toBeHidden();

  await tab(page, "Details").click();
  for (const id of ["opponent", "table", "contingency"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("log")).toBeHidden();
  await expectNoPageScroll(page);

  // SAE's opening pick is a new decision on screen, so the Play tab opens by itself.
  await page.getByRole("button", { name: "SAE", exact: true }).click();
  await expect(tab(page, "Play")).toHaveAttribute("aria-selected", "true");
  await expect(decision.getByRole("button").first()).toBeVisible();
  await expect(page.getByTestId("contingency")).toBeHidden();
});
