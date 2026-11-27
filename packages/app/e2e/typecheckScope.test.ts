// The app's `typecheck` script covers the browser tests and the Playwright settings (#670), so they cannot drift from
// the code they test without the gate seeing it.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const app = fileURLToPath(new URL("..", import.meta.url));

/** The files `tsc -p <config>` checks because the config includes them, as absolute paths with forward slashes. */
function filesOf(config: string): string[] {
  const read = ts.readConfigFile(path.join(app, config), (file) => ts.sys.readFile(file));
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, app);
  return parsed.fileNames.map((file) => path.resolve(file).replaceAll("\\", "/"));
}

/** Every TypeScript file under a folder of the app. */
function sourcesUnder(folder: string): string[] {
  return readdirSync(path.join(app, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => path.resolve(app, folder, file).replaceAll("\\", "/"));
}

describe("the app's type check", () => {
  it("runs the browser tests' config after the app's own", () => {
    const pkg = JSON.parse(readFileSync(path.join(app, "package.json"), "utf8")) as { scripts: { typecheck: string } };
    expect(pkg.scripts.typecheck).toBe("tsc -p tsconfig.json && tsc -p tsconfig.e2e.json");
  });

  it.each(["e2e", "e2e-stack"])("checks every TypeScript file under %s", (folder) => {
    const sources = sourcesUnder(folder);
    expect(sources.length).toBeGreaterThan(0);
    expect(filesOf("tsconfig.e2e.json")).toEqual(expect.arrayContaining(sources));
  });

  it("checks both Playwright configs", () => {
    const configs = readdirSync(app).filter((file) => /^playwright(\..+)?\.config\.ts$/.test(file));
    expect(configs).toHaveLength(2);
    expect(filesOf("tsconfig.e2e.json")).toEqual(
      expect.arrayContaining(configs.map((file) => path.resolve(app, file).replaceAll("\\", "/"))),
    );
  });
});
