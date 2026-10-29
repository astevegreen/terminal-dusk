// Region standings chips on the map (L8, #488), in the six-region game against the AI at both configured sizes
// (844x390 and 1280x800): six chips, one under each region's name, none over a country marker or a region's name,
// whole map or zoomed into a region, their longest line fits, and a chip changes once influence placed changes who
// controls a country. A screenshot of each size, whole map and zoomed, is saved in the test's output folder and
// attached.
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { startSixRegionGame } from "./start.ts";

type Box = { left: number; top: number; right: number; bottom: number };

/** Every chip that shares screen area with a country marker, a home box or a region's name, as "chip over thing". */
const chipsOverMap = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const meet = (a: Box, b: Box): boolean =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const things: [string, Box][] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".dm-marker, .dm-home"))
      things.push([el.dataset["country"] ?? `${el.dataset["home"]} home`, boxOf(el.getBoundingClientRect())]);
    for (const el of document.querySelectorAll<HTMLElement>(".dm-region")) {
      const name = document.createRange();
      name.selectNodeContents(el);
      things.push([`${el.dataset["region"]} name`, boxOf(name.getBoundingClientRect())]);
    }
    const over: string[] = [];
    for (const chip of document.querySelectorAll<HTMLElement>(".dm-chip")) {
      const box = boxOf(chip.getBoundingClientRect());
      for (const [name, thing] of things) if (meet(box, thing)) over.push(`${chip.dataset["region"]} over ${name}`);
    }
    return over;
  });

/** Whether the longest line a chip can show, "SAE every battleground 11", fits inside a chip in the chip's font. */
const longestLineFits = (page: Page): Promise<boolean> =>
  page
    .locator(".dm-chip")
    .first()
    .evaluate((chip) => {
      const line = chip.querySelector(".dm-chip-side")!.cloneNode() as HTMLElement;
      line.textContent = "SAE every battleground 11";
      chip.append(line);
      const fits = line.offsetWidth <= chip.clientWidth && line.scrollWidth <= line.clientWidth + 1;
      line.remove();
      return fits;
    });

/** Each chip's two lines as shown, by region. */
const chipTexts = (map: Locator): Promise<string[]> =>
  map
    .locator(".dm-chip")
    .evaluateAll((chips) =>
      chips.map((c) =>
        [...c.querySelectorAll(".dm-chip-side")]
          .map((s) => `${(c as HTMLElement).dataset["region"]}: ${s.textContent}`)
          .join(" | "),
      ),
    );

async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const path = testInfo.outputPath(`l8-${name}-${viewport.width}.png`);
  await page.screenshot({ path });
  await testInfo.attach(`${name} ${viewport.width}x${viewport.height}`, { path, contentType: "image/png" });
}

test("six standings chips sit under the region names, over no marker, whole map and zoomed in", async ({
  page,
}, testInfo) => {
  const map = await startSixRegionGame(page);
  await page.getByRole("region", { name: "Game details" }).getByRole("button", { name: "Hide" }).click();
  await map.getByRole("button", { name: "Whole map" }).click();

  const chips = map.locator(".dm-chip");
  await expect(chips).toHaveCount(6);
  for (const chip of await chips.all()) await expect(chip).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => chipsOverMap(page)).toEqual([]);
  expect(await longestLineFits(page)).toBe(true);
  // Every line names its side and ends with the region's points now, as the engine works them out.
  for (const text of await chipTexts(map)) expect(text).toMatch(/: LIO .*\d \| .*: SAE .*\d$/);
  // A reader hears each chip in full.
  await expect(map.getByRole("list", { name: "Region standings" }).getByRole("listitem")).toHaveCount(6);
  await shoot(page, testInfo, "whole");

  // Zoomed into Europe, its chip is large enough to read, and still covers nothing.
  await map.getByRole("button", { name: "Europe", exact: true }).click();
  const europe = map.locator('.dm-chip[data-region="europe"]');
  await expect(europe).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      europe
        .locator(".dm-chip-side")
        .first()
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeGreaterThanOrEqual(16);
  await expect.poll(() => chipsOverMap(page)).toEqual([]);
  await shoot(page, testInfo, "europe");
});

test("a chip changes after influence is placed", async ({ page }) => {
  const map = await startSixRegionGame(page);
  const decision = page.getByTestId("decision");
  const before = await chipTexts(map);
  expect(before).toHaveLength(6);
  // Play LIO's choices, placing influence in the same country while it can, until some chip reads differently.
  let target: string | undefined;
  for (let step = 0; step < 80; step++) {
    if ((await chipTexts(map)).join() !== before.join()) break;
    await expect(decision.getByRole("button").first()).toBeVisible();
    const names = await decision.getByRole("button").allTextContents();
    const places = names.filter((n) => n.startsWith("Place in "));
    if (target === undefined || !places.includes(target)) target = places[0];
    const pick =
      (places.length > 0 ? target : undefined) ??
      names.find((n) => n === "Place influence") ??
      names.find((n) => /: (points|influence|operations)/i.test(n)) ??
      names[0]!;
    // The click returns before the redraw: wait for what it changes, the country's LIO number after a placement,
    // otherwise the buttons.
    const country = pick.startsWith("Place in ") ? pick.slice("Place in ".length) : undefined;
    const lio = map.locator(`.dm-marker[data-country="${country}"] .dm-lio`);
    const seen = async (): Promise<string> =>
      country === undefined
        ? (await decision.getByRole("button").allTextContents()).join()
        : ((await lio.textContent()) ?? "");
    const was = await seen();
    await decision.getByRole("button", { name: pick, exact: true }).click();
    await expect.poll(seen).not.toBe(was);
  }
  expect((await chipTexts(map)).join()).not.toBe(before.join());
});
