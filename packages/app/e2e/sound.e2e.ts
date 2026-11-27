// Sound in a real browser (#645): the first tap unlocks it and a game's events play the manifest's files. The
// counting stand-in for the browser's sound is in soundPage.ts.
import { expect, test } from "@playwright/test";
import { answerNext, countSounds, counts, serveSounds, startGame, watch } from "./soundPage.ts";
import { fixRandom } from "./start.ts";

test("the first tap unlocks sound, and the game's events play the manifest's files", async ({ page }) => {
  await fixRandom(page, 1);
  await countSounds(page);
  const seen = watch(page);
  const listed = await serveSounds(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play the six-region map" })).toBeVisible();
  expect(await counts(page)).toEqual({ contexts: 0, started: 0 });
  expect(seen.files).toEqual([]);

  await startGame(page);
  await expect.poll(() => seen.files.length).toBe(listed);
  expect((await counts(page)).contexts).toBe(1);

  // A few moves are enough for an event with a sound to happen.
  for (let move = 0; move < 6 && (await counts(page)).started === 0; move++) await answerNext(page);
  await expect.poll(async () => (await counts(page)).started).toBeGreaterThan(0);
  expect(seen.errors).toEqual([]);
});

test("with no sound files the app plays a game, asks for none and raises no error", async ({ page }) => {
  await fixRandom(page, 1);
  await countSounds(page);
  const seen = watch(page);
  await page.goto("/");
  await startGame(page);
  for (let move = 0; move < 3; move++) await answerNext(page);
  expect(await counts(page)).toEqual({ contexts: 1, started: 0 });
  expect(seen.files).toEqual([]);
  expect(seen.errors).toEqual([]);
});
