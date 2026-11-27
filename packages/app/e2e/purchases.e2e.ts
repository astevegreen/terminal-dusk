// Buying the Full Game on the web (#685), seen by a signed-in free player (e2e/buyer/): the buy button, the sentence
// about other platforms, Restore purchase and the gift code field, in the account area and on the offer at a free
// game's end, each at least 44 px to tap at phone and desktop sizes and on a phone held upright (375x667).
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";
import { box, expectTapTargets, shoot } from "./measure.ts";
import { fixRandom, pageSize } from "./start.ts";

const BUYER_PAGE = "/e2e/buyer/index.html";
const UPRIGHT = { width: 375, height: 667 };
const NOTE = /^Placeholder: a purchase on the web does not unlock other platforms\./;

/** The buy button, the sentence, Restore and the gift code field are shown, can be used and are 44 px to tap. */
async function expectPurchaseControls(page: Page, area: Locator): Promise<void> {
  const buy = area.getByRole("button", { name: "Get the Full Game" });
  await expect(buy).toBeEnabled();
  await expect(area.getByText(NOTE)).toBeVisible();
  await expect(area.getByRole("button", { name: "Restore purchase" })).toBeVisible();
  const field = area.getByRole("textbox", { name: "Redeem a gift code" });
  await expect(field).toBeVisible();
  expect((await box(field)).height).toBeGreaterThanOrEqual(44);
  await expect(area.getByRole("button", { name: "Redeem", exact: true })).toBeVisible();
  await expectTapTargets(page);
  expect((await pageSize(page)).width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("the account area sells the Full Game, restores it and takes a gift code (#685)", async ({ page }, testInfo) => {
  await page.goto(BUYER_PAGE);
  await page.getByRole("button", { name: "Play online" }).click();
  const account = page.getByRole("region", { name: "The Full Game" });
  await account.getByRole("button", { name: "Redeem", exact: true }).scrollIntoViewIfNeeded();
  await expectPurchaseControls(page, account);
  await shoot(page, testInfo, "purchases", "account");

  await page.setViewportSize(UPRIGHT);
  await account.getByRole("button", { name: "Redeem", exact: true }).scrollIntoViewIfNeeded();
  await expectPurchaseControls(page, account);
  await shoot(page, testInfo, "purchases", "account-upright");
});

test("Get the Full Game opens the server's checkout address on the app's own pay page (#685)", async ({ page }) => {
  await page.goto(BUYER_PAGE);
  await page.getByRole("button", { name: "Play online" }).click();
  await page.getByRole("button", { name: "Get the Full Game" }).click();
  await page.waitForURL("**/pay/?_ptxn=txn_test1");
  const back = page.getByRole("link", { name: "Back to the game" });
  await expect(back).toBeVisible();
  expect((await box(back)).height).toBeGreaterThanOrEqual(44);
});

test("the offer at a free game's end sells the Full Game, with Restore and a gift code (#685)", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await fixRandom(page, 668);
  await page.goto(BUYER_PAGE);
  await page.getByRole("button", { name: "Play the free game: The Thaw (Era 1)" }).click();
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  const gameOver = page.getByTestId("status-bar").getByText(/^Game over: /);
  for (let step = 0; step < 100 && !(await gameOver.isVisible()); step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();

  const offer = page.getByRole("region", { name: "The Full Game" });
  const buy = offer.getByRole("button", { name: "Get the Full Game" });
  const newGame = page.getByRole("button", { name: "New game" });
  for (const [name, size] of [
    ["offer", page.viewportSize()!],
    ["offer-upright", UPRIGHT],
  ] as const) {
    await page.setViewportSize(size);
    // Folded, the offer stays small: the buy button and New game are on screen.
    await expect(buy).toBeInViewport({ ratio: 1 });
    await expect(newGame).toBeInViewport({ ratio: 1 });
    await shoot(page, testInfo, "purchases", name);
    await offer.getByText("Restore or redeem a gift code", { exact: true }).click();
    await offer.getByRole("button", { name: "Redeem", exact: true }).scrollIntoViewIfNeeded();
    await expectPurchaseControls(page, offer);
    await shoot(page, testInfo, "purchases", `${name}-open`);
    await offer.getByText("Restore or redeem a gift code", { exact: true }).click();
  }
});
