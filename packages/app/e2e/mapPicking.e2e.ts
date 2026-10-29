// Choosing countries by tapping them on the map (L7, #487), in the six-region game against the AI at both configured
// sizes (844x390 and 1280x800): a placing, a realignment and an intervention are each answered by tapping a glowing
// country; a tap on a dim country, or a drag across a glowing one, never answers; a country answers only when its
// marker is at least 44 px tall at that moment (the first tap zooms); the banner names countries, never ids; the
// keyboard picks with Tab and Enter; and the List still answers. Screenshots of a placing are saved and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  answerOnce,
  answeredOrRefused,
  countryButtons,
  decisionButtons,
  playFromStrip,
  questionIdOf,
  tapCountry,
  yourDecision,
} from "./answer.ts";
import { startSixRegionGame } from "./start.ts";

const banner = (page: Page): Locator => page.getByTestId("decision");
const bannerText = async (page: Page): Promise<string> => (await banner(page).textContent()) ?? "";
const MENU = /: spend all \d+ points? on one action/;
const PLACING = /: place 1 influence \(\d+ points? left\)/;
const REALIGN = /: realign \(\d+ attempts? left\)/;

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l7-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
  const shots = process.env["L7_SHOTS"];
  if (shots !== undefined) await page.screenshot({ path: `${shots}/l7-${name}-${viewport.width}.png` });
}

/** Answers LIO's decisions, playing cards for their points, until the banner asks `asked`. */
async function playUntil(page: Page, asked: RegExp, choose?: (names: string[]) => string | undefined): Promise<void> {
  for (let step = 0; step < 80; step++) {
    await expect(yourDecision(page)).toBeVisible();
    const text = await bannerText(page);
    if (asked.test(text)) return;
    const names = await decisionButtons(page).allTextContents();
    const pick = choose?.(names);
    if (pick !== undefined) {
      const question = await questionIdOf(page);
      await decisionButtons(page).getByText(pick, { exact: true }).click();
      await answeredOrRefused(page, question);
    } else if (names.length === 0 && (await countryButtons(page).count()) === 0) await playFromStrip(page);
    else await answerOnce(page);
  }
  throw new Error(`the banner never asked ${asked}`);
}

/** The ids of the countries that glow, and of those that are dim. */
const pickStates = (page: Page): Promise<{ glow: string[]; dim: string[] }> =>
  page.evaluate(() => {
    const ids = (state: string) =>
      [...document.querySelectorAll<HTMLElement>(`.dm-marker[data-pick="${state}"]`)].map((m) => m.dataset["country"]!);
    return { glow: ids("glow"), dim: ids("dim") };
  });

/** The view the wrapper's CSS transform shows. */
async function scaleOf(page: Page): Promise<number> {
  const transform = await page.locator(".dm-world").evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([\d.e-]+)\)/.exec(transform)?.[1]);
}

test("a placing: tap a glowing country to place; a dim one or a drag never answers; 44 px at the moment it answers", async ({
  page,
}, testInfo) => {
  const map = await startSixRegionGame(page);
  await playUntil(page, PLACING, (names) => names.find((n) => n === "Place influence"));
  // The banner asks in words, with a hint, and no country is a button there; the countries glow on the map.
  await expect(banner(page)).toContainText("Tap a glowing country on the map.");
  await expect(decisionButtons(page)).toHaveCount(0);
  const { glow, dim } = await pickStates(page);
  expect(glow.length).toBeGreaterThan(0);
  expect(dim.length).toBeGreaterThan(0);
  // Each glowing country is a button named after its choice and its numbers, by the country's name, never its id.
  const name = (await countryButtons(page).first().textContent()) ?? "";
  expect(name).toMatch(/^Place in [A-Z].*: LIO \d+, SAE \d+, stability \d+/);
  for (const id of glow) expect(await countryButtons(page).allTextContents()).not.toContain(`Place in ${id}:`);
  await shoot(page, testInfo, "placing");

  // A tap on a dim country never answers: it falls through to its region, which zooms in.
  const question = await questionIdOf(page);
  const before = await scaleOf(page);
  await map.locator(`.dm-marker[data-country="${dim[0]}"]`).click({ force: true });
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(before);
  expect(await questionIdOf(page)).toBe(question);
  await map.getByRole("button", { name: "Whole map", exact: true }).click();

  // A drag that starts on a glowing country moves the map and never answers.
  const target = countryButtons(page).first();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect(await questionIdOf(page)).toBe(question);

  // A tap answers: the first zooms in while the marker is under 44 px tall, the next picks it at 44 px or more.
  const { box: tapped, taken } = await tapCountry(page, countryButtons(page).first());
  expect(taken).toBe(true);
  expect(tapped.height).toBeGreaterThanOrEqual(43.5);
  await shoot(page, testInfo, "placed");
});

test("an intervention and a realignment are each answered by tapping a glowing country", async ({ page }) => {
  await startSixRegionGame(page);
  // An action menu that offers an intervention: its target countries glow, beside the other actions in the banner.
  await playUntil(page, MENU);
  let intervened = false;
  for (let turn = 0; turn < 12 && !intervened; turn++) {
    await playUntil(page, MENU);
    if ((await countryButtons(page).count()) > 0) {
      await expect(decisionButtons(page).getByText("Place influence", { exact: true })).toBeVisible();
      expect(await countryButtons(page).first().textContent()).toMatch(/^Intervene in [A-Z]/);
      const { taken } = await tapCountry(page, countryButtons(page).first());
      intervened = taken;
    } else {
      // No intervention offered yet: place, so the game goes on.
      await decisionButtons(page).getByText("Place influence", { exact: true }).click();
    }
  }
  expect(intervened).toBe(true);

  // A realignment: "Realign" in the menu, then its targets glow and "Stop realigning" stays in the banner.
  let realigned = false;
  for (let turn = 0; turn < 12 && !realigned; turn++) {
    await playUntil(page, MENU);
    const realign = decisionButtons(page).getByText("Realign", { exact: true });
    if (!(await realign.isVisible())) {
      await decisionButtons(page).getByText("Place influence", { exact: true }).click();
      continue;
    }
    await realign.click();
    await expect(banner(page)).toContainText(REALIGN);
    await expect(decisionButtons(page).getByText("Stop realigning", { exact: true })).toBeVisible();
    if ((await countryButtons(page).count()) === 0) {
      await decisionButtons(page).getByText("Stop realigning", { exact: true }).click();
      continue;
    }
    expect(await countryButtons(page).first().textContent()).toMatch(/^Realign in [A-Z]/);
    realigned = (await tapCountry(page, countryButtons(page).first())).taken;
  }
  expect(realigned).toBe(true);
});

test("keyboard: focus lands on a glowing country, the map moves to it, Tab moves along them and Enter picks", async ({
  page,
}) => {
  await startSixRegionGame(page);
  await playUntil(page, MENU);
  // Choose "Place influence" by keyboard, so the next decision's focus is the keyboard's.
  await decisionButtons(page).getByText("Place influence", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toContainText(PLACING);
  const first = countryButtons(page).first();
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(countryButtons(page).nth(1)).toBeFocused();
  // The focused country is wholly inside the map area: the map moved, without zooming, to show it.
  const area = (await page.locator(".dm-view").boundingBox())!;
  const at = (await countryButtons(page).nth(1).boundingBox())!;
  expect(at.x).toBeGreaterThanOrEqual(area.x - 0.5);
  expect(at.y).toBeGreaterThanOrEqual(area.y - 0.5);
  expect(at.x + at.width).toBeLessThanOrEqual(area.x + area.width + 0.5);
  expect(at.y + at.height).toBeLessThanOrEqual(area.y + area.height + 0.5);
  // Enter picks it at any zoom: a keyboard's click always answers.
  const question = await questionIdOf(page);
  await page.keyboard.press("Enter");
  expect(await answeredOrRefused(page, question)).toBe(true);
});

test("the List offers the same countries as buttons, by name, and still answers", async ({ page }) => {
  const map = await startSixRegionGame(page);
  await playUntil(page, PLACING, (names) => names.find((n) => n === "Place influence"));
  await map.getByRole("button", { name: "List", exact: true }).click();
  const picks = map.locator(".map-pick");
  expect(await picks.count()).toBeGreaterThan(0);
  expect(await picks.first().textContent()).toMatch(/^Place in [A-Z]/);
  expect((await picks.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const question = await questionIdOf(page);
  await picks.first().click();
  expect(await answeredOrRefused(page, question)).toBe(true);
});
