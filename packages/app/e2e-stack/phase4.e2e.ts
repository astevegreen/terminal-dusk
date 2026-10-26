// The phase 4 gate in a real browser (A10; docs/architecture.md, "Revised build order", phase 4). Two browser contexts
// sign in by email code on the local Supabase stack, one creates a private game and the other joins it by code, and
// the two play it through the online game screen to its end, one press at a time. Every response the stack sends
// either browser is checked for hidden data against what the server held at that step.
//
// Run from packages/app, through the stack lock (it waits if another folder has the stack):
//   pnpm exec node ../../tools/stack-lock.mjs playwright test -c playwright.stack.config.ts
// Needs the local stack (its keys in the environment, from `supabase status -o env`), the auth-email function served
// with LOCAL_MAIL_URL and the stack's hook secret (#369), and the mail catcher. The catcher's address is MAILPIT_URL
// (or INBUCKET_URL) when set, else the Supabase CLI's local default, http://127.0.0.1:54324. Without them the test skips
// with one line saying what is missing and how to start it; it never fails for a stopped stack.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";
import { HOW_TO_START, serverSnapshot, stackKeys, whyUnavailable } from "../src/transport/test/localStack.ts";
import { checkResponses, frameSeqOf } from "./leakCheck.ts";
import type { Recorded } from "./leakCheck.ts";
import { mailpitUrl, waitForCode, whyMailUnavailable } from "./mail.ts";
import { grantWebByEmail, removeRun } from "./runUsers.ts";

const TITLE = "phase 4 gate: two browsers sign in by email code, create and join a private game and play it to its end";
/** The whole game must end within this (at most 10 minutes), and within this many presses. */
const TIME_LIMIT_MS = 10 * 60_000;
const STEP_LIMIT = 1_500;
const WAIT_MS = 30_000;
const SIDES: Side[] = ["lio", "sae"];
const RESULTS = ["You won", "You lost", "Draw"];

const MAIL_HOW_TO_START =
  "For sign-in codes to reach the mail catcher, serve auth-email with LOCAL_MAIL_URL and the stack's SEND_EMAIL_HOOK_SECRET " +
  "in packages/server/supabase/functions/.env (#369; HOW_TO_START in packages/server/src/migrations/localStack.ts). " +
  `Stack: ${HOW_TO_START}`;

const keys = stackKeys();
const mail = mailpitUrl(process.env);
const unavailable = keys
  ? ((await whyUnavailable(keys).then((why) =>
      why === null ? null : `${why}. ${HOW_TO_START}. ${MAIL_HOW_TO_START}`,
    )) ?? (await whyMailUnavailable(keys, mail, MAIL_HOW_TO_START)))
  : `no local Supabase keys in the environment. ${MAIL_HOW_TO_START}`;

// An address unique to this run, so two runs never meet and the clean-up finds exactly this run's users.
const runId = crypto.randomUUID().slice(0, 8);
const emails: Record<Side, string> = {
  lio: `lio-${runId}@terminal-dusk.test`,
  sae: `sae-${runId}@terminal-dusk.test`,
};

test.afterAll(async () => {
  // Runs after a failure or a time-out too: finds the run's users by email (they exist from "Send code" on).
  if (keys && unavailable === null) await removeRun(keys, [emails.lio, emails.sae]);
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `read` until it gives a value that is not undefined, or fails with `what` after `waitMs`. */
async function until<T>(
  what: string,
  read: () => Promise<T | undefined> | T | undefined,
  waitMs = WAIT_MS,
): Promise<T> {
  for (let waited = 0; waited <= waitMs; waited += 100) {
    const value = await read();
    if (value !== undefined) return value;
    await sleep(100);
  }
  throw new Error(`timed out after ${waitMs / 1000} s waiting for ${what}`);
}

/** No sideways scroll, and every visible button at least 44 px high, on the screen showing now. */
async function expectFits(page: Page, screen: string): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, `${screen} scrolls sideways`).toBe(true);
  const heights = await page
    .locator("button:visible")
    .evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
  expect(heights.length, `${screen} shows no buttons`).toBeGreaterThan(0);
  const small = heights.filter((h) => h < 44);
  expect(small, `${screen} has buttons under 44 px high`).toEqual([]);
}

test(TITLE, async ({ browser }) => {
  if (unavailable !== null || keys === null) {
    console.warn(`${TITLE}: did not run: ${unavailable}`);
    test.skip(true, `did not run: ${unavailable}`);
    return;
  }
  const stack = keys;
  const project = test.info().project.use;
  const pageFor = async (): Promise<Page> =>
    (await browser.newContext({ baseURL: project.baseURL, viewport: project.viewport })).newPage();
  const pages: Record<Side, Page> = { lio: await pageFor(), sae: await pageFor() };

  // What each browser was sent by the stack, with the server's step when it arrived (-1 before the first read).
  let current = -1;
  const responses: Recorded[] = [];
  const frameSeq: Record<Side, number> = { lio: -1, sae: -1 };
  const matchIds: Record<Side, string | null> = { lio: null, sae: null };
  const secrets = new Map<number, MatchSecret>();
  const reading: Promise<void>[] = [];
  for (const side of SIDES) {
    pages[side].on("response", (response) => {
      const url = response.url();
      if (!url.startsWith(stack.url)) return;
      const atSeq = current;
      reading.push(
        response.text().then(
          (text) => {
            responses.push({ side, url, text, atSeq });
            const seq = frameSeqOf({ url, text });
            if (seq !== null) frameSeq[side] = Math.max(frameSeq[side], seq);
            matchIds[side] ??= /\/rest\/v1\/match_view\?.*match_id=eq\.([^&]+)/.exec(url)?.[1] ?? null;
          },
          () => undefined, // a reply with no body to read (a redirect, a preflight) has nothing to check
        ),
      );
    });
  }

  // 1 and 4. Each player signs in through the screens: Play online, an email, Send code, the code from the catcher.
  for (const side of SIDES) {
    const page = pages[side];
    await page.goto("/");
    await page.getByRole("button", { name: "Play online" }).click();
    await page.getByLabel("Email address").fill(emails[side]);
    if (side === "lio") await expectFits(page, "the sign-in screen");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByLabel("Code", { exact: true })).toBeVisible();
    const code = await waitForCode(mail, emails[side], WAIT_MS);
    await page.getByLabel("Code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "New game" })).toBeVisible();
  }
  await expectFits(pages.lio, "the lobby screen");

  // 5. The test grants the creator the web entitlement, then the creator makes a private game and the other joins it.
  await grantWebByEmail(stack, emails.lio);
  await pages.lio.getByRole("button", { name: "I play LIO" }).click();
  await pages.lio.getByRole("button", { name: "Create game" }).click();
  const inviteCode = (
    await until("the invite code on the creator's screen", async () => {
      const text = await pages.lio.locator('section[aria-labelledby="lobby-new"] div > p').first().textContent();
      return text?.trim() || undefined;
    })
  ).trim();
  await pages.sae.getByLabel("Invite code").fill(inviteCode);
  await pages.sae.getByRole("button", { name: "Join", exact: true }).click();
  await expect(pages.sae.locator('main p[role="status"]')).toBeVisible();
  // The creator opens the new game from My games.
  await until("the creator's new game in My games", async () => {
    await pages.lio.getByRole("button", { name: "Refresh" }).click();
    return (await pages.lio.getByRole("button", { name: "Open", exact: true }).count()) > 0 ? true : undefined;
  });
  await pages.lio.getByRole("button", { name: "Open", exact: true }).click();
  for (const side of SIDES) await expect(pages[side].locator('main p[role="status"]')).toBeVisible();

  const matchId = await until("both screens to open the same match", () =>
    matchIds.lio !== null && matchIds.lio === matchIds.sae ? matchIds.lio : undefined,
  );
  // 8. The server's state at step 0, before the first press, then at every step.
  const first = await serverSnapshot(stack, matchId);
  const firstSeq = first.secret.state.meta.seq;
  secrets.set(firstSeq, first.secret);
  current = firstSeq;
  await until("both screens to show the first step", () =>
    frameSeq.lio >= firstSeq && frameSeq.sae >= firstSeq ? true : undefined,
  );

  const turnLine = (side: Side): Promise<string> => pages[side].locator('main p[role="status"]').innerText();
  const shown = async (side: Side): Promise<boolean> => frameSeq[side] === current;
  /** Who may press now: a side whose screen says "Your move" on the newest step; null once both show a result. */
  const nextMover = async (): Promise<Side | null> =>
    until("a screen to say Your move or both to show a result", async () => {
      const lines = { lio: await turnLine("lio"), sae: await turnLine("sae") };
      if (RESULTS.includes(lines.lio) && RESULTS.includes(lines.sae) && (await shown("lio")) && (await shown("sae"))) {
        return null;
      }
      for (const side of SIDES) if (lines[side] === "Your move" && (await shown(side))) return side;
      return undefined;
    });

  /** Reads the server after a move, then waits for the moving screen to show the new step. */
  const settle = async (side: Side, seq: number): Promise<void> => {
    const snap = await until(`the server to reach step ${seq}`, async () => {
      const s = await serverSnapshot(stack, matchId);
      return s.secret.state.meta.seq >= seq ? s : undefined;
    });
    expect(snap.secret.state.meta.seq, "one press moves the server by one step").toBe(seq);
    secrets.set(seq, snap.secret);
    current = seq;
    await until(`the ${side} screen to show step ${seq}`, () => (frameSeq[side] >= seq ? true : undefined));
    // Two animation frames, so React has drawn what the screen was just sent.
    await pages[side].evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  };

  /** Presses the first enabled choice of the decision and waits to settle; fails at once if the server refuses it. */
  const press = async (side: Side): Promise<void> => {
    const [reply] = await Promise.all([
      pages[side].waitForResponse(
        (r) => r.url() === `${stack.url}/functions/v1/submit` && r.request().method() === "POST",
      ),
      pages[side].getByTestId("decision").locator("button:enabled").first().click(),
    ]);
    const raw = await reply.text();
    let body: { ok?: unknown; seq?: unknown; code?: unknown } = {};
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      // not JSON: reported below with the status and the raw text
    }
    if (body.ok === true && typeof body.seq === "number") return settle(side, body.seq);
    throw new Error(
      `the server refused the first choice of the ${side} decision at step ${current}: ` +
        `status ${reply.status()}, code ${String(body.code)}, body ${raw.slice(0, 300)}`,
    );
  };

  // 6 and 7. One press at a time, until both screens show a result.
  const started = Date.now();
  let steps = 0;
  for (let checkedGameScreen = false; ;) {
    const mover = await nextMover();
    if (mover === null) break;
    if (!checkedGameScreen) {
      await expectFits(pages[mover], "the online game screen");
      checkedGameScreen = true;
    }
    if (steps >= STEP_LIMIT || Date.now() - started > TIME_LIMIT_MS) {
      throw new Error(
        `the game had not ended after ${steps} steps and ${Math.round((Date.now() - started) / 1000)} s ` +
          `(limits: ${STEP_LIMIT} steps, ${TIME_LIMIT_MS / 60_000} minutes)`,
      );
    }
    await press(mover);
    steps += 1;
  }
  const results = { lio: await turnLine("lio"), sae: await turnLine("sae") };
  const agree =
    (results.lio === "You won" && results.sae === "You lost") ||
    (results.lio === "You lost" && results.sae === "You won") ||
    (results.lio === "Draw" && results.sae === "Draw");
  expect(agree, `the two screens disagree on the result after ${steps} steps`).toBe(true);

  // 8 and 9. Everything the stack sent either browser, each body against its own step's secret.
  await Promise.all(reading);
  const all = responses.map((r) => (r.atSeq < 0 ? { ...r, atSeq: firstSeq } : r));
  const { checked, problems } = checkResponses(all, secrets);
  console.log(`${TITLE}: ${steps} steps, ${checked} responses checked, ${problems.length} leaks`);
  expect(checked).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});
