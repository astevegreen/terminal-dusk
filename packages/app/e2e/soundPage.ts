// Shared by the sound tests (not a test file: only *.e2e.ts files are tests). Headless browsers have no speakers, so
// the page's AudioContext is a stand-in that counts what was started. No sound file is in the repository: a test that
// needs one serves its own manifest and bytes.
import type { Page } from "@playwright/test";
import { SOUND_IDS } from "../src/audio/cues.ts";
import { answerOnce, yourDecision } from "./answer.ts";

type Counts = { contexts: number; started: number };

export const counts = (page: Page): Promise<Counts> =>
  page.evaluate(() => (window as unknown as { soundCounts: Counts }).soundCounts);

/** Replaces the page's AudioContext, before the app loads, with one that counts. */
export async function countSounds(page: Page): Promise<void> {
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

/** Serves a manifest that gives every sound id a stand-in file; returns how many it lists. */
export async function serveSounds(page: Page): Promise<number> {
  const sounds = SOUND_IDS.map((id) => ({ id, file: `test-${id}.ogg` }));
  // The app imports the manifest as a module (vite.config.ts), so this one stands in for it.
  const asModule = `export default ${JSON.stringify({ sounds })};`;
  await page.route(/virtual(:|%3A)sound-manifest/, (route) =>
    route.fulfill({ contentType: "text/javascript", body: asModule }),
  );
  await page.route("**/sounds/test-*.ogg", (route) => route.fulfill({ contentType: "audio/ogg", body: "bytes" }));
  return sounds.length;
}

/** The addresses asked for under sounds/, and every error the page raised. */
export function watch(page: Page): { files: string[]; errors: string[] } {
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

export async function startGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play the six-region map" }).click();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await page.getByTestId("decision").waitFor();
}

/** Answers the player's next decision, once the AI has made its moves. */
export async function answerNext(page: Page): Promise<void> {
  await yourDecision(page).waitFor();
  await answerOnce(page);
}
