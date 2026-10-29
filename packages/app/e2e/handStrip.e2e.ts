// The hand strip (L6, #486), run at both configured sizes (844x390 and 1280x800): the hand is a slim strip along the
// bottom edge, each card a chip at least 44 px tall; a full hand fits (scrolling sideways if it must); tapping a
// card lifts it over the middle third of the screen with its text and its choices, which answer the decision; a tap
// elsewhere or Escape drops it; and the keyboard moves along the strip. A screenshot of each size, with a card
// lifted, is saved in the test's output folder and attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { answerOnce, decisionButtons, liftedCard, stripChips, yourDecision } from "./answer.ts";
import { pageSize, startSixRegionGame } from "./start.ts";

const box = (locator: Locator): Promise<DOMRect> => locator.evaluate((el) => el.getBoundingClientRect().toJSON());

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l6-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}

test("the hand is a slim strip along the bottom: a full hand fits, each card at least 44 px, with the counts", async ({
  page,
}) => {
  await startSixRegionGame(page);
  const viewport = page.viewportSize()!;
  const strip = page.getByTestId("hand");
  const stripBox = await box(strip);
  // Along the bottom edge; at most 56 px tall on a phone held sideways (Decision 6), slim on a large screen too.
  expect(stripBox.bottom).toBeCloseTo(viewport.height, 0);
  expect(stripBox.left).toBeCloseTo(0, 0);
  expect(stripBox.height).toBeLessThanOrEqual(viewport.height <= 400 ? 56 : 72);

  // A full first hand: every card has a chip at least 44 px tall inside the strip; one the strip has no room for is
  // reached by scrolling the strip sideways, never the page.
  const chips = stripChips(page);
  const count = await chips.count();
  expect(count).toBeGreaterThanOrEqual(7);
  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    await chip.scrollIntoViewIfNeeded();
    const chipBox = await box(chip);
    expect(chipBox.height).toBeGreaterThanOrEqual(44);
    expect(chipBox.width).toBeGreaterThanOrEqual(44);
    expect(chipBox.top).toBeGreaterThanOrEqual(stripBox.top - 0.5);
    expect(chipBox.bottom).toBeLessThanOrEqual(stripBox.bottom + 0.5);
    expect(chipBox.left).toBeGreaterThanOrEqual(-0.5);
    expect(chipBox.right).toBeLessThanOrEqual(viewport.width + 0.5);
    // Its points value and its name; the side's colour is its edge.
    await expect(chip.locator(".strip-chip-points")).toHaveText(/^\d+$/);
    await expect(chip.locator(".strip-chip-name")).not.toBeEmpty();
    expect(["lio", "sae", "neutral"]).toContain(await chip.getAttribute("data-side"));
  }
  const size = await pageSize(page);
  expect(size.width).toBeLessThanOrEqual(viewport.width);
  expect(size.height).toBeLessThanOrEqual(viewport.height);

  // Beside the cards: the rival's hand size, the deck and the discard pile, as numbers only.
  const counts = page.getByTestId("strip-counts");
  await expect(counts).toBeVisible();
  await expect(counts).toContainText(/Rival \d+/);
  await expect(counts).toContainText(/Deck \d+/);
  await expect(counts).toContainText(/Discard \d+/);
});

test("tapping a card lifts it over the middle third with its text; a tap elsewhere, Escape or a second tap drops it", async ({
  page,
}, testInfo) => {
  await startSixRegionGame(page);
  const viewport = page.viewportSize()!;
  const chips = stripChips(page);
  await expect(liftedCard(page)).toHaveCount(0);

  await chips.first().click();
  const lifted = liftedCard(page);
  await expect(lifted).toHaveCount(1);
  await expect(chips.first()).toHaveAttribute("aria-expanded", "true");
  await expect(lifted.locator(".hand-card-name")).toHaveText(
    await chips.first().locator(".strip-chip-name").innerText(),
  );
  await expect(lifted.locator(".hand-card-rules")).toBeVisible();
  // Over the middle third of the screen at most, above the strip and below the top bar.
  const card = await box(lifted);
  expect(card.left).toBeGreaterThanOrEqual(viewport.width / 3 - 1);
  expect(card.right).toBeLessThanOrEqual((viewport.width * 2) / 3 + 1);
  expect(card.bottom).toBeLessThanOrEqual((await box(page.getByTestId("hand"))).top + 0.5);
  expect(card.top).toBeGreaterThanOrEqual((await box(page.locator(".game-top"))).bottom - 0.5);
  // Every button on the lifted card is a tap target, and is what a tap at its centre lands on.
  for (const button of await lifted.getByRole("button").all()) {
    const b = await box(button);
    expect(b.height).toBeGreaterThanOrEqual(44);
    const hit = await button.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(hit).toBe(true);
  }
  await shoot(page, testInfo, "lifted");

  // A tap elsewhere (here the top bar's status line) drops it.
  await page.getByTestId("status-bar").click();
  await expect(lifted).toHaveCount(0);
  await expect(chips.first()).toHaveAttribute("aria-expanded", "false");

  // Escape drops it, and the keyboard's place goes back to its chip.
  await chips.nth(1).click();
  await expect(liftedCard(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(liftedCard(page)).toHaveCount(0);
  await expect(chips.nth(1)).toBeFocused();

  // A second tap on its chip drops it; a tap on another chip lifts that card instead.
  await chips.nth(1).click();
  await chips.nth(2).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(chips.nth(2)).toHaveAttribute("aria-expanded", "true");
  await chips.nth(2).click();
  await expect(liftedCard(page)).toHaveCount(0);
  await shoot(page, testInfo, "strip");
});

/** Answers decisions until the waiting one asks for a play, then returns its question's text. */
async function untilPlay(page: Page): Promise<void> {
  const play = page.getByTestId("decision").getByText(/: play a card for its event or its points$/);
  for (let step = 0; step < 30; step++) {
    await yourDecision(page).waitFor();
    if (await play.isVisible()) return;
    await answerOnce(page);
  }
  throw new Error("no play decision within 30 steps");
}

test("a play through a real turn: the lifted card's Points button answers it, and the card leaves the strip", async ({
  page,
}) => {
  await startSixRegionGame(page);
  await untilPlay(page);
  // The play's choices are on the cards, not in the decision's region, which says so.
  await expect(decisionButtons(page)).toHaveCount(0);
  await expect(page.getByTestId("decision")).toContainText("Tap a card in your hand");
  const chips = stripChips(page);
  const before = await chips.count();
  // One of LIO's own or a neutral card, so no rival event asks to go before or after the points.
  const own = page.getByTestId("hand").locator('.strip-chip:not([data-side="sae"])');
  let played = "";
  for (let i = 0; i < (await own.count()) && played === ""; i++) {
    await own.nth(i).click();
    const points = liftedCard(page).getByRole("button", { name: /: points$/ });
    if ((await points.count()) === 0) continue;
    played = (await points.innerText()).replace(/: points$/, "");
    await points.click();
  }
  expect(played).not.toBe("");
  // Played for its points: the action menu waits, and the card has left the hand, so nothing is lifted.
  await expect(page.getByTestId("decision")).toContainText(/spend all \d+ points? on one action/);
  await expect(chips).toHaveCount(before - 1);
  await expect(liftedCard(page)).toHaveCount(0);
  await expect(chips.locator(".strip-chip-name", { hasText: played })).toHaveCount(0);
});

test("keyboard: the arrow keys move along the strip, Enter lifts onto the card's choices, Escape drops", async ({
  page,
}) => {
  await startSixRegionGame(page);
  await untilPlay(page);
  const chips = stripChips(page);
  // A play's choices are on the cards, so focus starts on the strip.
  await expect(page.locator(".strip-chip:focus")).toHaveCount(1);
  await page.keyboard.press("Home");
  await expect(chips.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(chips.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(chips.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(chips.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(chips.first()).toBeFocused();
  // Only the chip the keyboard is on takes Tab.
  await expect(chips.first()).toHaveAttribute("tabindex", "0");
  await expect(chips.nth(1)).toHaveAttribute("tabindex", "-1");

  // Enter lifts the card and moves the keyboard's place onto its first choice; Escape drops it, back on its chip.
  for (let i = 0; i < (await chips.count()); i++) {
    await expect(chips.nth(i)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(liftedCard(page)).toHaveCount(1);
    const choices = liftedCard(page).getByRole("button");
    if ((await choices.count()) > 0) {
      await expect(choices.first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(liftedCard(page)).toHaveCount(0);
      await expect(chips.nth(i)).toBeFocused();
      return;
    }
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowRight");
  }
  throw new Error("no card offered a play");
});
