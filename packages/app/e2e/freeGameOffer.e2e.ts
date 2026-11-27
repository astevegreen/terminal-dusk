// The free game against the AI ends with the Full Game offer (#668): a guest plays its 3 turns from the home screen
// with the network off, sees the result and the offer, and no request leaves the page. It runs on the built app, as
// players get it (builtApp.ts), at phone (844x390) and desktop sizes.
import { expect, test } from "@playwright/test";
import { answerOnce, yourDecision } from "./answer.ts";
import { serveBuiltApp } from "./builtApp.ts";
import { expectFullGameOffer } from "./fullGameOffer.ts";
import { fixRandom } from "./start.ts";

let app: Awaited<ReturnType<typeof serveBuiltApp>>;
test.beforeAll(async () => {
  app = await serveBuiltApp();
});
test.afterAll(async () => {
  await app.stop();
});

test("the free game against the AI ends with the result and the Full Game offer, offline (#668)", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await fixRandom(page, 668);
  await page.goto(app.url);
  await expect(page.getByRole("button", { name: "Play the free game: The Thaw (Era 1)" })).toBeVisible();
  await context.setOffline(true);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Play the free game: The Thaw (Era 1)" }).click();
  await page.getByRole("radio", { name: "Easy" }).check();
  await page.getByRole("button", { name: "Play as LIO" }).click();
  await expect(page.getByTestId("decision")).toBeVisible();
  const offer = page.getByRole("region", { name: "The Full Game" });
  await expect(offer).toHaveCount(0);

  const gameOver = page.getByTestId("status-bar").getByText(/^Game over: /);
  for (let step = 0; step < 100 && !(await gameOver.isVisible()); step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();

  await expectFullGameOffer(page);

  expect(requests.filter((url) => !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});
