// The pay page as it is built (#685), with Paddle's script stood in for: it starts Paddle in test mode with the public
// client token, which opens the checkout the address names, and returns the player to the game. Nothing reaches
// Paddle. The token here is made up.
import { expect, test } from "@playwright/test";
import { serveBuiltApp } from "./builtApp.ts";
import { box } from "./measure.ts";

const PADDLE = "https://cdn.paddle.com/**";
const PADDLE_STAND_IN = `window.Paddle = {
  Environment: { set: (name) => { window.paddleEnvironment = name; } },
  Initialize: (options) => { window.paddleOptions = options; },
};`;

type Seen = {
  paddleEnvironment?: string;
  paddleOptions?: {
    token: string;
    checkout: { settings: { successUrl: string } };
    eventCallback(event: { name: string }): void;
  };
};

let app: Awaited<ReturnType<typeof serveBuiltApp>>;
const before = { token: process.env.VITE_PADDLE_CLIENT_TOKEN, environment: process.env.VITE_PADDLE_ENV };
const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

test.beforeAll(async () => {
  process.env.VITE_PADDLE_CLIENT_TOKEN = "made-up-for-this-test";
  process.env.VITE_PADDLE_ENV = "sandbox";
  app = await serveBuiltApp();
});
test.afterAll(async () => {
  await app.stop();
  restore("VITE_PADDLE_CLIENT_TOKEN", before.token);
  restore("VITE_PADDLE_ENV", before.environment);
});

test("the pay page starts Paddle's test mode, and closing the checkout returns to the game (#685)", async ({
  page,
}) => {
  await page.route(PADDLE, (route) => route.fulfill({ contentType: "text/javascript", body: PADDLE_STAND_IN }));
  await page.goto(new URL("pay/?_ptxn=txn_test1", app.url).href);
  await page.waitForFunction(() => (window as unknown as Seen).paddleOptions !== undefined);
  const seen = await page.evaluate(() => {
    const { paddleEnvironment, paddleOptions } = window as unknown as Seen;
    return {
      environment: paddleEnvironment,
      token: paddleOptions!.token,
      success: paddleOptions!.checkout.settings.successUrl,
    };
  });
  expect(seen).toEqual({
    environment: "sandbox",
    token: "made-up-for-this-test",
    success: new URL("/?purchase=done", app.url).href,
  });
  await page.evaluate(() => (window as unknown as Seen).paddleOptions!.eventCallback({ name: "checkout.closed" }));
  await page.waitForURL(new URL("/", app.url).href);
  await expect(page.getByRole("button", { name: "Play online" })).toBeVisible();
});

test("the pay page says nothing was charged when Paddle's script can't be loaded (#685)", async ({ page }) => {
  await page.route(PADDLE, (route) => route.abort());
  await page.goto(new URL("pay/?_ptxn=txn_test1", app.url).href);
  await expect(page.getByRole("status")).toHaveText("Payment isn't available right now. Nothing was charged.");
  expect((await box(page.getByRole("link", { name: "Back to the game" }))).height).toBeGreaterThanOrEqual(44);
});
