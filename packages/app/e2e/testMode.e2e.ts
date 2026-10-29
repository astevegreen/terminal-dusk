import { expect, test } from "@playwright/test";
import { liftedCard, stripChips } from "./answer.ts";

test("test mode: LIO and SAE pick an opening card and the reveal shows in the log", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Test mode" }).click();
  await expect(page.getByRole("heading", { name: "Test mode" })).toBeVisible();

  // LIO picks its first card from the hand strip (L6, #486): tap the card to lift it, then its pick button.
  await stripChips(page)
    .filter({ hasText: /^\d*Test card 1$/ })
    .click();
  await liftedCard(page).getByRole("button", { name: "Test card 1", exact: true }).click();
  // Then SAE picks.
  await page.getByRole("button", { name: "SAE", exact: true }).click();
  await expect(page.getByTestId("hand")).toContainText("Test card 9");
  await stripChips(page)
    .filter({ hasText: /^\d*Test card 9$/ })
    .click();
  await liftedCard(page).getByRole("button", { name: "Test card 9", exact: true }).click();

  // Both cards are now revealed, so their events show in SAE's log.
  await expect(page.getByTestId("log")).toContainText("Marker Test card 1 event");
  await expect(page.getByTestId("log")).toContainText("Marker Test card 9 event");
  await expect(page.getByTestId("refusal")).toHaveText("No refusal");
});
