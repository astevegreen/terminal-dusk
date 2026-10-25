// Where the Playwright smoke tests serve the app (playwright.config.ts). Each run picks a free port, so two folders'
// runs never share a server, and a run never tests another folder's code or a `pnpm dev` left running (README S4).
import { execFileSync } from "node:child_process";

type Env = Record<string, string | undefined>;

// Asks the computer for a port nobody is listening on. It runs in a child process because a config file can't wait.
const FREE_PORT =
  "const s = require('node:net').createServer(); s.listen(0, () => { process.stdout.write(String(s.address().port)); s.close(); });";

/**
 * The run's port: E2E_PORT when it is set, otherwise a free one, which is then kept in E2E_PORT. Playwright loads its
 * config again in each worker, and the workers inherit E2E_PORT, so they all use the port the first load picked.
 */
export function e2ePort(env: Env = process.env): number {
  env.E2E_PORT ||= execFileSync(process.execPath, ["-e", FREE_PORT], { encoding: "utf8" }).trim();
  const port = Number(env.E2E_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`E2E_PORT is "${env.E2E_PORT}", which isn't a port number (1 to 65535).`);
  return port;
}

/** The address the tests open, and the server Playwright starts for them on the run's own port. */
export function e2eServer(env: Env = process.env) {
  const port = e2ePort(env);
  const url = `http://localhost:${port}`;
  return {
    baseURL: url,
    // A server already on the port is someone else's: another folder's run, or a `pnpm dev`. Never test it.
    webServer: { command: `pnpm exec vite --port ${port} --strictPort`, url, reuseExistingServer: false },
  };
}
