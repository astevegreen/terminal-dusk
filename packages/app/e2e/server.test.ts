// The Playwright run's own port (server.ts): a free one, kept for the run's workers, never a server already running.
import { createServer, type Server } from "node:net";
import { describe, expect, it } from "vitest";
import { e2ePort, e2eServer } from "./server.ts";

type Env = Record<string, string | undefined>;

const listen = (port: number) =>
  new Promise<Server | null>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(null));
    server.listen(port, () => resolve(server));
  });
const close = (server: Server) => new Promise((resolve) => server.close(resolve));

describe("the Playwright run's port", () => {
  it("is a free port, kept in E2E_PORT so every worker of the run uses the same one", async () => {
    const env: Env = {};
    const port = e2ePort(env);
    expect(env.E2E_PORT).toBe(String(port));
    expect(e2ePort(env)).toBe(port);
    const server = await listen(port);
    expect(server).not.toBeNull();
    if (server) await close(server);
  });

  it("is never a port another run is serving on", async () => {
    const other = await listen(0);
    if (!other) throw new Error("could not listen on any port");
    const taken = (other.address() as { port: number }).port;
    try {
      for (let run = 0; run < 5; run++) expect(e2ePort({})).not.toBe(taken);
    } finally {
      await close(other);
    }
  });

  it("is the E2E_PORT already set, when there is one", () => {
    expect(e2ePort({ E2E_PORT: "5311" })).toBe(5311);
  });

  it("refuses an E2E_PORT that isn't a port number", () => {
    for (const bad of ["abc", "0", "70000", "51.5"])
      expect(() => e2ePort({ E2E_PORT: bad })).toThrow(`E2E_PORT is "${bad}", which isn't a port number`);
  });
});

describe("the server the Playwright run tests", () => {
  it("is the one the run starts, on the run's port, and never one already running", () => {
    const { baseURL, webServer } = e2eServer({ E2E_PORT: "5311" });
    expect(baseURL).toBe("http://localhost:5311");
    expect(webServer).toEqual({
      command: "pnpm exec vite --port 5311 --strictPort",
      url: "http://localhost:5311",
      reuseExistingServer: false,
    });
  });
});
