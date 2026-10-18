import { expect, test } from "@playwright/test";

test("test mode: LIO and SAE pick an opening card and the reveal shows in the log", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByRole("heading", { name: "Test mode" })).toBeVisible();

  // LIO picks its first card, then SAE picks.
  await page.getByRole("button", { name: "Test card 1", exact: true }).click();
  await page.getByRole("button", { name: "SAE" }).click();
  await expect(page.getByTestId("hand")).toContainText("Test card 9");
  await page.getByRole("button", { name: "Test card 9", exact: true }).click();

  // Both cards are now revealed, so their events show in SAE's log.
  await expect(page.getByTestId("log")).toContainText("Marker Test card 1 event");
  await expect(page.getByTestId("log")).toContainText("Marker Test card 9 event");
  await expect(page.getByTestId("refusal")).toHaveText("No refusal");
});
