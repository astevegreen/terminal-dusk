// What a free game shows at its end (#647, #668), checked the same way in each test that plays one out.
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** The offer: its placeholder label and words, and a buy button that cannot be tapped yet, 44 px tall, on screen,
 *  with New game after it; the AI had no answer refused. */
export async function expectFullGameOffer(page: Page): Promise<void> {
  const offer = page.getByRole("region", { name: "The Full Game" });
  await expect(offer.getByText("Placeholder offer", { exact: true })).toBeVisible();
  await expect(offer.getByText(/^Placeholder: the free game ends after Era 1/)).toBeVisible();
  const buy = offer.getByRole("button", { name: "Get the Full Game" });
  await expect(buy).toBeDisabled();
  const box = await buy.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
}
