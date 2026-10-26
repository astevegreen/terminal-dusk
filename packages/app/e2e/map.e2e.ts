import { expect, test } from "@playwright/test";

// Issue #366: test mode plays on R14's test map, so A13a's badges show in the running app.
test("test mode map: the 12 country badges show for every viewer and the page does not scroll sideways", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByRole("heading", { name: "Test mode" })).toBeVisible();

  const badges = page.getByTestId("map-area").locator(".map-badge");
  for (const viewer of ["LIO", "SAE", "Spectator"]) {
    await page.getByRole("button", { name: viewer, exact: true }).click();
    await expect(page.getByRole("button", { name: viewer, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(badges).toHaveCount(12);
    await expect(badges.first()).toBeVisible();
    const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noSideScroll).toBe(true);
  }
});
