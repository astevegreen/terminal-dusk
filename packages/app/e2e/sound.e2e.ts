// Sound in a real browser (#645): the first tap unlocks it and a game's events play the manifest's files. Headless
// browsers have no speakers, so the page's AudioContext is a stand-in that counts what was started. No sound file is
// in the repository: the test that needs one serves its own manifest and bytes.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SOUND_IDS } from "../src/audio/cues.ts";
import { answerOnce, yourDecision } from "./answer.ts";
import { fixRandom } from "./start.ts";

type Counts = { contexts: number; started: number };

const counts = (page: Page): Promise<Counts> =>
  page.evaluate(() => (window as unknown as { soundCounts: Counts }).soundCounts);

/** Replaces the page's AudioContext, before the app loads, with one that counts. */
async function countSounds(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tally = { contexts: 0, started: 0 };
    class CountingContext {
      state = "suspended";
      destination = {};
      constructor() {
        tally.contexts += 1;
      }
      async resume(): Promise<void> {
        this.state = "running";
      }
      async decodeAudioData(data: ArrayBuffer): Promise<unknown> {
        return { bytes: data.byteLength };
      }
      createGain() {
        return { gain: { value: 1 }, connect() {} };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {
            tally.started += 1;
          },
        };
      }
    }
    Object.assign(window, { AudioContext: CountingContext, soundCounts: tally });
  });
}

/** The addresses asked for under sounds/, and every error the page raised. */
function watch(page: Page): { files: string[]; errors: string[] } {
  const seen = { files: [] as string[], errors: [] as string[] };
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.includes("/sounds/")) seen.files.push(pathname);
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") seen.errors.push(message.text());
  });
  return seen;
}

async function startGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play the six-region map" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
}

/** Answers the player's next decision, once the AI has made its moves. */
async function answerNext(page: Page): Promise<void> {
  await yourDecision(page).waitFor();
  await answerOnce(page);
}

test("the first tap unlocks sound, and the game's events play the manifest's files", async ({ page }) => {
  await fixRandom(page, 1);
  await countSounds(page);
  const seen = watch(page);
  const sounds = SOUND_IDS.map((id) => ({ id, file: `test-${id}.ogg` }));
  // The app imports the manifest as a module (vite.config.ts), so this one stands in for it.
  const asModule = `export default ${JSON.stringify({ sounds })};`;
  await page.route(/virtual(:|%3A)sound-manifest/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: asModule }),
  );
  await page.route("**/sounds/test-*.ogg", (route) => route.fulfill({ contentType: "audio/ogg", body: "bytes" }));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play the six-region map" })).toBeVisible();
  expect(await counts(page)).toEqual({ contexts: 0, started: 0 });
  expect(seen.files).toEqual([]);

  await startGame(page);
  await expect.poll(() => seen.files.length).toBe(sounds.length);
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
