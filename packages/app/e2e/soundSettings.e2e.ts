// Mute and volume in a real browser (#646), at the phone and desktop sizes: the controls are reachable tap targets,
// what the player chooses survives a reload, and muted means nothing plays.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { yourDecision } from "./answer.ts";
import { box, expectNoPageScroll } from "./measure.ts";
import { answerNext, countSounds, counts, serveSounds, startGame, watch } from "./soundPage.ts";
import { fixRandom } from "./start.ts";

const homeMute = (page: Page): Locator => page.getByRole("button", { name: "Mute", exact: true });
const volume = (page: Page): Locator => page.getByRole("slider", { name: "Volume" });
const gameMute = (page: Page): Locator => page.getByTestId("hand").getByRole("button", { name: "Mute", exact: true });

async function expectReachable(control: Locator, name: string): Promise<void> {
  await expect(control, name).toBeInViewport({ ratio: 1 });
  const size = await box(control);
  expect(size.width, `${name} width`).toBeGreaterThanOrEqual(44);
  expect(size.height, `${name} height`).toBeGreaterThanOrEqual(44);
}

test("Home: the mute toggle and the volume slider are reachable, and their state survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await expectReachable(homeMute(page), "Mute");
  await expectReachable(volume(page), "Volume");
  await expect(homeMute(page)).toHaveAttribute("aria-pressed", "false");
  await expect(volume(page)).toHaveValue("80");

  await homeMute(page).click();
  await volume(page).fill("35");
  await expect(homeMute(page)).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(homeMute(page)).toHaveAttribute("aria-pressed", "true");
  await expect(volume(page)).toHaveValue("35");

  await homeMute(page).click();
  await page.reload();
  await expect(homeMute(page)).toHaveAttribute("aria-pressed", "false");
  await expect(volume(page)).toHaveValue("35");
});

test("in game: the mute button is by the hand strip, shares Home's setting, and survives a reload", async ({
  page,
}) => {
  await fixRandom(page, 1);
  await page.goto("/");
  await startGame(page);
  await expectReachable(gameMute(page), "Mute");
  await expectNoPageScroll(page);
  await expect(gameMute(page)).toHaveAttribute("aria-pressed", "false");
  await gameMute(page).click();
  await expect(gameMute(page)).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(homeMute(page)).toHaveAttribute("aria-pressed", "true");
  await startGame(page);
  await expect(gameMute(page)).toHaveAttribute("aria-pressed", "true");
});

test("muted, a game starts no sound; unmuted in game, its events play again", async ({ page }) => {
  await fixRandom(page, 1);
  await countSounds(page);
  const seen = watch(page);
  const listed = await serveSounds(page);
  await page.goto("/");
  await homeMute(page).click();
  await startGame(page);
  await expect.poll(() => seen.files.length).toBe(listed);

  // The moves in which sound.e2e.ts hears its first sound.
  for (let move = 0; move < 6; move++) await answerNext(page);
  // Once the AI has made its moves, every event so far has reached the screen.
  await yourDecision(page).waitFor();
  expect((await counts(page)).started).toBe(0);

  await gameMute(page).click();
  for (let move = 0; move < 6 && (await counts(page)).started === 0; move++) await answerNext(page);
  await expect.poll(async () => (await counts(page)).started).toBeGreaterThan(0);
  expect(seen.errors).toEqual([]);
});
