// The built app, served for one test file (not a test file: only *.e2e.ts files are tests). The other smoke tests use
// the dev server (server.ts), which serves their test pages; only a build carries the AI's worker inside the page
// (src/vsAi/workerAi.ts), so a test that goes offline needs this one (#642).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Builds the app into a folder of its own and serves it on a free port; `stop` ends the server and removes the folder. */
export async function serveBuiltApp(): Promise<{ url: string; stop: () => Promise<void> }> {
  // Each Playwright worker builds its own copy, so two projects running at once never share a folder.
  const outDir = mkdtempSync(join(tmpdir(), "td-built-app-"));
  await build({ root, logLevel: "error", build: { outDir, emptyOutDir: true } });
  const server = await preview({ root, logLevel: "error", build: { outDir }, preview: { port: 0, open: false } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("the built app's server has no address");
  return {
    url,
    stop: async () => {
      await server.close();
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}
