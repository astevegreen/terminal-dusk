// The tutorial offline (#642, phase 5's gate "the tutorial passes offline"): a guest opens it with the network off,
// is coached through the first card, sees the hint and the end of the coaching, and the game goes on. A second test
// plays a free player's tutorial to its end after Era 1 (3 turns), where the result and the Full Game offer show
// (#647). The coach's box leaves the map's tools free to tap (#666). All run on the built app, as players get it
// (builtApp.ts).
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { answerOnce, decisionButtons, yourDecision } from "./answer.ts";
import { serveBuiltApp } from "./builtApp.ts";
import { box, expectNoPageScroll, expectTapTargets } from "./measure.ts";
import { fixRandom } from "./start.ts";
import { expectFullGameOffer } from "./fullGameOffer.ts";

// The placeholder lesson's words (packages/content/tutorial/placeholder.json) and the screen's own lines
// (packages/app/src/tutorial/TutorialScreen.tsx).
const COACH = "Placeholder: play any card from your hand.";
const HINT = "Placeholder: a hint, which never limits your answers.";
const OVER = "Placeholder: coaching is over; the game goes on.";

let app: Awaited<ReturnType<typeof serveBuiltApp>>;
test.beforeAll(async () => {
  app = await serveBuiltApp();
});
test.afterAll(async () => {
  await app.stop();
});

/** Answers whatever waits for LIO until `line` shows in the coach's corner. */
async function answerUntil(page: Page, line: Locator): Promise<void> {
  for (let step = 0; step < 60 && !(await line.isVisible()); step++) {
    await yourDecision(page).or(line).first().waitFor();
    if (await line.isVisible()) return;
    await answerOnce(page);
  }
  await expect(line).toBeVisible();
}

test("a guest plays the tutorial offline: coached, hinted, then the game goes on", async ({ page, context }) => {
  await fixRandom(page, 642);
  await page.goto(app.url);
  await expect(page.getByRole("button", { name: "Tutorial" })).toBeVisible();
  await context.setOffline(true);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  // No sign-in: the guest opens it straight from Home.
  await page.getByRole("button", { name: "Tutorial" }).click();
  await expect(page.locator(".tutorial-coach").getByText("Placeholder lesson", { exact: true })).toBeVisible();
  const coach = page.getByRole("status", { name: "Coach" });
  await answerUntil(page, coach.getByText(COACH, { exact: true }));
  await expect(coach.getByText("Placeholder chapter 1", { exact: true })).toBeVisible();

  // A choice the coach refuses is greyed out, never hidden. The placeholder's coach allows every card, so any
  // disabled button here would be a bug in the limits.
  const refused = decisionButtons(page).and(page.locator(":disabled"));
  await expect(refused).toHaveCount(0);

  // Play the card, then the hint, then the end of the coaching.
  await answerOnce(page);
  await answerUntil(page, coach.getByText(HINT, { exact: true }));
  await answerUntil(page, coach.getByText(OVER, { exact: true }));

  // The game goes on: one more play is accepted, and nothing was refused.
  await yourDecision(page).waitFor();
  await answerOnce(page);
  await expect(page.getByText(/^AI refused:/)).toHaveCount(0);
  await expect(page.getByText("Game over")).toHaveCount(0);

  // Nothing left the page for the network.
  expect(requests.filter((url) => !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});

type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;
/** Whether two boxes share any area; touching edges do not count. */
const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

/** The coach box lies over none of the map's tools, the decision banner or the hand strip, shows all its text on
 *  the screen, and the page does not scroll. */
async function expectCoachClear(page: Page): Promise<void> {
  const coach = page.locator(".tutorial-coach");
  const coachBox = await box(coach);
  const others = {
    "map tools": page.getByRole("toolbar", { name: "Map view" }),
    "decision banner": page.getByTestId("decision"),
    "hand strip": page.getByTestId("hand"),
  };
  for (const [name, other] of Object.entries(others)) {
    await expect(other).toBeVisible();
    expect(overlaps(coachBox, await box(other)), `the coach box overlaps the ${name}`).toBe(false);
  }
  const viewport = page.viewportSize()!;
  expect(coachBox.left).toBeGreaterThanOrEqual(0);
  expect(coachBox.top).toBeGreaterThanOrEqual(0);
  expect(coachBox.right).toBeLessThanOrEqual(viewport.width);
  expect(coachBox.bottom).toBeLessThanOrEqual(viewport.height);
  // Nothing in the box is cut off, and nothing else is drawn over its words.
  const text = await coach.evaluate((el) => ({
    cut: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
    covered: [...el.querySelectorAll("p, h2")]
      .filter((line) => {
        const r = line.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === null || !el.contains(hit);
      })
      .map((line) => line.textContent),
  }));
  expect(text).toEqual({ cut: false, covered: [] });
  await expectNoPageScroll(page);
}

// The second is a narrow phone held upright, where the tools are one row across the map's top.
for (const size of [
  { width: 844, height: 390 },
  { width: 375, height: 667 },
]) {
  test(`the coach box stays clear of the map's tools at ${size.width}x${size.height} (#666)`, async ({ page }) => {
    // The game is answered up to the first coached card held sideways, then the screen takes the size under test.
    await page.setViewportSize({ width: 844, height: 390 });
    await fixRandom(page, 642);
    await page.goto(app.url);
    await page.getByRole("button", { name: "Tutorial" }).click();
    await answerUntil(page, page.getByRole("status", { name: "Coach" }).getByText(COACH, { exact: true }));
    await yourDecision(page).waitFor();
    await page.setViewportSize(size);

    await expectCoachClear(page);
    await expectTapTargets(page);
    // A covered button fails its click: Playwright waits until nothing else would take the tap.
    const tool = (name: string): Locator =>
      page.getByRole("toolbar", { name: "Map view" }).getByRole("button", { name, exact: true });
    await tool("Whole map").click({ timeout: 5_000 });
    await tool("List").click({ timeout: 5_000 });
    await expect(tool("List")).toHaveAttribute("aria-pressed", "true");
    // The List moves the tools, so the same holds there.
    await expectCoachClear(page);
    await tool("Map").click({ timeout: 5_000 });
    await expect(tool("Map")).toHaveAttribute("aria-pressed", "true");
  });
}

test("a free player's tutorial ends after Era 1 with the result and the Full Game offer, offline (#647)", async ({
  page,
  context,
}) => {
  // Three turns on the six-region map, every country tapped through the zoom: as long as the other map games.
  test.setTimeout(240_000);
  await fixRandom(page, 647);
  await page.goto(app.url);
  await context.setOffline(true);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Tutorial" }).click();

  const gameOver = page.getByTestId("status-bar").getByText(/^Game over: /);
  for (let step = 0; step < 200 && !(await gameOver.isVisible()); step++) {
    await yourDecision(page).or(gameOver).first().waitFor();
    if (await gameOver.isVisible()) break;
    await answerOnce(page);
  }
  await expect(gameOver).toBeVisible();
  await expect(page.getByTestId("status-bar").getByText("Turn 3 of 3")).toBeVisible();

  await expectFullGameOffer(page);

  expect(requests.filter((url) => !url.startsWith("blob:") && !url.startsWith("data:"))).toEqual([]);
});
