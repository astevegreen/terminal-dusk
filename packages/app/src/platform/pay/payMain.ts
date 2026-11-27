// The start of the pay page (pay/index.html). Not part of the app: this is the only place Paddle's script is loaded.
// The build gives the public client token (VITE_PADDLE_CLIENT_TOKEN) and, for test mode, VITE_PADDLE_ENV=sandbox.
import { startPayPage } from "./payPage.ts";
import type { PaddleApi } from "./payPage.ts";

const PADDLE_SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";

const setting = (value: unknown): string => (typeof value === "string" ? value : "");

const loadPaddle = (): Promise<PaddleApi> =>
  new Promise((resolve, reject) => {
    const failed = (): void => reject(new Error("Paddle.js could not be started"));
    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT;
    script.onerror = failed;
    script.onload = () => {
      const { Paddle } = globalThis as unknown as { Paddle?: PaddleApi };
      if (Paddle) resolve(Paddle);
      else failed();
    };
    document.head.append(script);
  });

void startPayPage({
  token: setting(import.meta.env.VITE_PADDLE_CLIENT_TOKEN),
  environment: setting(import.meta.env.VITE_PADDLE_ENV),
  search: globalThis.location.search,
  origin: globalThis.location.origin,
  loadPaddle,
  go: (url) => globalThis.location.assign(url),
  say: (words) => {
    const status = document.getElementById("pay-status");
    if (status) status.textContent = words;
  },
});
