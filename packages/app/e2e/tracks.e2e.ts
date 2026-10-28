// The score track and Escalation on screen (A15, #448): test mode's map has scoring, so the region shows there at
// a phone held upright, held sideways and at desktop size, with no sideways scroll; the six-region map has none.
// Set TRACKS_SHOTS to a folder to save a screenshot at each size.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const SIZES = [
  { name: "phone-375", width: 375, height: 667 },
  { name: "phone-844", width: 844, height: 390 },
  { name: "desktop", width: 1280, height: 800 },
];

async function noSideScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

for (const size of SIZES) {
  test(`test mode shows the score track and Escalation at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await page.getByRole("button", { name: "Test mode" }).click();
    const tracks = page.getByTestId("tracks");
    await expect(tracks).toBeVisible();
    await expect(tracks.getByRole("meter", { name: "Score track" })).toHaveAttribute("aria-valuemax", "20");
    await expect(tracks).toContainText("Score: even");
    await expect(tracks).toContainText("LIO wins at -20");
    await expect(tracks).toContainText("SAE wins at +20");
    await expect(tracks).toContainText(/Escalation \d of 6: .+\. Closed: /);
    const box = await tracks.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(await noSideScroll(page)).toBe(true);
    if (process.env["TRACKS_SHOTS"])
      await page.screenshot({ path: `${process.env["TRACKS_SHOTS"]}/tracks-${size.name}.png` });
  });
}

test("the six-region map has no scoring, so no score track or Escalation shows", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByRole("button", { name: "Play the six-region map" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  await expect(page.getByTestId("tracks")).toHaveCount(0);
});
