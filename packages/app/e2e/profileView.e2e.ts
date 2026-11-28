// The profile view in a real browser (#680), on a test page (profile/) with a made-up row: at the phone size
// (844x390) and the desktop sizes it shows each state, the Back button is a whole 44 px tap target, and nothing
// scrolls sideways even with a very long name. (A 375 px width is checked too.)
import { expect, test } from "@playwright/test";
import { expectTapTargets } from "./measure.ts";
import { sizesFor } from "./sizes.ts";

const WORDS: Record<string, string> = {
  rated: "Rating: 1512",
  unrated: "Rating: Unrated",
  loading: "Loading",
  failed: "The rating could not be read",
};

for (const [state, words] of Object.entries(WORDS)) {
  test(`profile ${state}: shows its words, keeps tap targets, and does not scroll sideways`, async ({ page }) => {
    for (const size of [...sizesFor(page), { width: 375, height: 667 }]) {
      await page.setViewportSize(size);
      await page.goto(`/e2e/profile/index.html?state=${state}`);
      await expect(page.getByText(words, { exact: false })).toBeVisible();
      await expect(page.getByTestId("placeholder-note")).toBeVisible();
      const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(noSideScroll, `${size.width}`).toBe(true);
      await expectTapTargets(page);
    }
  });
}

test("profile rated: says Provisional under 10 ranked games and keeps both records", async ({ page }) => {
  await page.goto("/e2e/profile/index.html?state=rated");
  await expect(page.getByTestId("provisional")).toHaveText("Provisional");
  await expect(page.getByTestId("record-lio")).toHaveText("As LIO: 4 won, 2 lost, 1 drawn");
  await expect(page.getByTestId("record-sae")).toHaveText("As SAE: 3 won, 1 lost, 1 drawn");
});
