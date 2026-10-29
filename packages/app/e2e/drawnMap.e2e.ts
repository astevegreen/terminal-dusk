// The drawn map (L2, #465) in the six-region game against the AI, at the phone and desktop sizes: 42 markers and the
// two home boxes, all inside the map area with none overlapping; a region tap zooms in and "Whole map" goes back;
// the wheel zooms around the cursor without scrolling the page; a drag moves the map; two fingers pinch; and the
// countries a move touched light up. On the real-geography map (L3, #479), the world picture loads under the
// markers and its credit shows. With L2_SHOTS set to a folder, it saves a screenshot of each.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { startSixRegionGame } from "./start.ts";

type View = { scale: number; x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

const SHOTS = process.env["L2_SHOTS"];

/** The shared start, then waits until the drawn map has fitted itself to the map area. */
async function startDrawnMap(page: Page): Promise<Locator> {
  const area = await startSixRegionGame(page);
  await expect(area.locator(".dm-world")).toHaveAttribute("style", /transform/);
  return area;
}

/** Folds the sheet: its open panel lies over the lower map (L5, #485), where the wheel and drag tests point. */
async function foldSheet(page: Page): Promise<void> {
  await page.getByRole("region", { name: "Game details" }).getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
}

/** The view the wrapper's CSS transform shows: screen = drawing × scale + (x, y). */
async function viewOf(area: Locator): Promise<View> {
  const transform = await area.locator(".dm-world").evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.e-]+)\)/.exec(transform);
  if (!m) throw new Error(`not a map transform: ${transform}`);
  return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]) };
}

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const b = await boxOf(locator);
  return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
}

async function shoot(page: Page, name: string): Promise<void> {
  if (SHOTS === undefined) return;
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/l2-${size?.width}x${size?.height}-${name}.png` });
}

test("the whole map: 42 markers and both home boxes inside the map area, none overlapping, nothing sideways", async ({
  page,
}) => {
  const area = await startDrawnMap(page);
  const markers = area.locator(".dm-marker");
  await expect(markers).toHaveCount(42);
  await expect(area.locator(".dm-home")).toHaveText(["LIO home", "SAE home"]);

  const view = await boxOf(area.locator(".dm-view"));
  const boxes = await Promise.all([...(await markers.all()), ...(await area.locator(".dm-home").all())].map(boxOf));
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(view.left - 0.5);
    expect(b.right).toBeLessThanOrEqual(view.right + 0.5);
    expect(b.top).toBeGreaterThanOrEqual(view.top - 0.5);
    expect(b.bottom).toBeLessThanOrEqual(view.bottom + 0.5);
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(overlaps(boxes[i]!, boxes[j]!), `boxes ${i} and ${j}`).toBe(false);

  // Every short name fits its marker: none is cut off.
  const cutOff = await area
    .locator(".dm-name")
    .evaluateAll((names) =>
      names
        .filter((n) => n.scrollWidth > n.clientWidth + 1)
        .map((n) => `${n.textContent} ${n.scrollWidth}/${n.clientWidth}`),
    );
  expect(cutOff).toEqual([]);
  // The region buttons are the map's tap targets: each at least 44 px each way at the whole-map zoom.
  const regions = await Promise.all((await area.locator(".dm-region").all()).map(boxOf));
  expect(regions).toHaveLength(6);
  for (const r of regions) {
    expect(r.right - r.left).toBeGreaterThanOrEqual(44);
    expect(r.bottom - r.top).toBeGreaterThanOrEqual(44);
  }
  const noSideScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noSideScroll).toBe(true);
  await shoot(page, "whole");
});

test("the world picture loads under the markers, with the regions tinted and its credit in the toolbar", async ({
  page,
}) => {
  const area = await startDrawnMap(page);
  const picture = area.locator("img.dm-picture");
  await expect
    .poll(() => picture.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth))
    .toBe(2800);
  await expect(area.locator(".dm-tint")).toHaveCount(6);
  await expect(area.locator(".dm-borders")).toHaveAttribute("d", /^M\d/);
  await expect(area.locator(".dm-credit")).toHaveText("Blue Marble imagery: NASA Earth Observatory");
  await expect(area.locator(".dm-credit")).toBeInViewport();
  await shoot(page, "world");
});

test("tapping a region zooms in on it, and Whole map goes back to the whole map", async ({ page }) => {
  const area = await startDrawnMap(page);
  const whole = await viewOf(area);
  await area.getByRole("button", { name: "Europe", exact: true }).click();
  await expect.poll(async () => (await viewOf(area)).scale).toBeGreaterThan(whole.scale * 1.5);
  await expect(area.locator('.dm-marker[data-country="poland"]')).toBeInViewport();
  await shoot(page, "zoomed");
  await area.getByRole("button", { name: "Whole map" }).click();
  expect(await viewOf(area)).toEqual(whole);
});

test("the wheel zooms in around the cursor and the page does not scroll", async ({ page }) => {
  const area = await startDrawnMap(page);
  await foldSheet(page);
  const before = await viewOf(area);
  const cursor = await centreOf(area.locator(".dm-view"));
  const viewBox = await boxOf(area.locator(".dm-view"));
  const local = { x: cursor.x - viewBox.left, y: cursor.y - viewBox.top };
  const under = { x: (local.x - before.x) / before.scale, y: (local.y - before.y) / before.scale };
  const scrolls = () =>
    page.evaluate(() => [window.scrollY, document.querySelector('[data-testid="map-area"]')!.scrollTop]);
  const scrolledBefore = await scrolls();

  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await viewOf(area)).scale).toBeGreaterThan(before.scale);
  const after = await viewOf(area);
  expect(under.x * after.scale + after.x).toBeCloseTo(local.x, 0);
  expect(under.y * after.scale + after.y).toBeCloseTo(local.y, 0);
  expect(await scrolls()).toEqual(scrolledBefore);
});

test("a drag moves the zoomed-in map without zooming, and is not a tap on the region under it", async ({ page }) => {
  const area = await startDrawnMap(page);
  await foldSheet(page);
  const whole = await viewOf(area);
  const centre = await centreOf(area.locator(".dm-view"));
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await viewOf(area)).scale).toBeGreaterThan(whole.scale);
  const before = await viewOf(area);

  await page.mouse.down();
  await page.mouse.move(centre.x + 80, centre.y + 10, { steps: 8 });
  await page.mouse.up();
  const after = await viewOf(area);
  expect(after.scale).toBe(before.scale);
  expect(after.x).not.toBe(before.x);
  // A tap on a region would have fitted it, changing the scale: the drag's click was not a tap.
  await page.waitForTimeout(100);
  expect((await viewOf(area)).scale).toBe(before.scale);
});

test("two fingers spread twice as far apart double the zoom", async ({ page }) => {
  const area = await startDrawnMap(page);
  const before = await viewOf(area);
  const centre = await centreOf(area.locator(".dm-view"));
  await area.locator(".dm-view").evaluate((el, c) => {
    const touch = (type: string, pointerId: number, x: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: "touch",
          isPrimary: pointerId === 11,
          clientX: x,
          clientY: c.y,
          bubbles: true,
        }),
      );
    touch("pointerdown", 11, c.x - 40);
    touch("pointerdown", 12, c.x + 40);
    for (let step = 1; step <= 4; step++) {
      touch("pointermove", 11, c.x - 40 - step * 10);
      touch("pointermove", 12, c.x + 40 + step * 10);
    }
    touch("pointerup", 11, c.x - 80);
    touch("pointerup", 12, c.x + 80);
  }, centre);
  expect((await viewOf(area)).scale).toBeCloseTo(before.scale * 2, 2);
});

/** What the screen shows after a placement: its country lit while LIO still places, or the turn gone on. */
async function afterPlacing(decision: Locator, marker: Locator): Promise<"lit" | "moved on"> {
  let seen: "lit" | "moved on" | "waiting" = "waiting";
  // Polled, as the click returns before the redraw: the old buttons are still on screen for a moment.
  await expect
    .poll(async () => {
      const stillPlacing = (await decision.getByRole("button").allTextContents()).some((n) =>
        n.startsWith("Place in "),
      );
      if (!stillPlacing) seen = "moved on";
      else if ((await marker.getAttribute("data-touched")) === "true") seen = "lit";
      return seen;
    })
    .not.toBe("waiting");
  return seen === "lit" ? "lit" : "moved on";
}

/**
 * Plays LIO's choices, placing influence where it can, until `count` placements were each seen lit. While LIO is
 * still placing, the frame shown is the one the placement made, so its country must light up; once the turn goes
 * on, a later frame's own events decide what is lit. Returns the countries seen lit, in order.
 */
async function placeAndWatch(page: Page, area: Locator, count: number): Promise<string[]> {
  const lit: string[] = [];
  const decision = page.getByTestId("decision");
  for (let step = 0; step < 60 && lit.length < count; step++) {
    await expect(decision.getByRole("button").first()).toBeVisible();
    const names = await decision.getByRole("button").allTextContents();
    const place = names.find((n) => n.startsWith("Place in "));
    const pick =
      place ??
      names.find((n) => n === "Place influence") ??
      names.find((n) => /: (points|influence|operations)/i.test(n)) ??
      names[0]!;
    await decision.getByRole("button", { name: pick, exact: true }).click();
    if (place === undefined) continue;
    const country = place.slice("Place in ".length);
    if ((await afterPlacing(decision, area.locator(`.dm-marker[data-country="${country}"]`))) === "lit")
      lit.push(country);
  }
  return lit;
}

test("placing influence lights up the country it was placed in", async ({ page }) => {
  const area = await startDrawnMap(page);
  await expect(area.locator(".dm-marker[data-touched]")).toHaveCount(0);
  const lit = await placeAndWatch(page, area, 3);
  expect(lit).toHaveLength(3);
  await expect(area.locator(`.dm-marker[data-country="${lit[2]}"]`)).toHaveAttribute("data-touched", "true");
  await shoot(page, "highlight");
});
