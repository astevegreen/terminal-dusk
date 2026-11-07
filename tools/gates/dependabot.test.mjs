// Dependabot's settings (.github/dependabot.yml) that the rest of the repo relies on. Read as text: the repo has no
// YAML parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const config = readFileSync(path.join(ROOT, ".github", "dependabot.yml"), "utf8");
// Each `- package-ecosystem:` entry, by ecosystem.
const entries = new Map(
  config
    .split(/^(?= {2}- package-ecosystem:)/m)
    .slice(1)
    .map((e) => [/package-ecosystem: (\S+)/.exec(e)[1], e]),
);

test("it updates the packages and the GitHub Actions, weekly, minor and patch grouped", () => {
  assert.deepEqual([...entries.keys()].sort(), ["github-actions", "npm"]);
  for (const [name, entry] of entries) {
    assert.match(entry, /directory: \/\n/, name);
    assert.match(entry, /interval: weekly/, name);
    assert.match(entry, /update-types: \[minor, patch\]/, name);
  }
});

test("its cooldown is pnpm's minimumReleaseAge, so pnpm installs every version it proposes", () => {
  const workspace = readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const minutes = Number(/^minimumReleaseAge: (\d+)/m.exec(workspace)?.[1]);
  assert.ok(minutes > 0, "pnpm-workspace.yaml has no minimumReleaseAge");
  for (const [name, entry] of entries) {
    const days = Number(/cooldown:\n\s+default-days: (\d+)/.exec(entry)?.[1]);
    assert.equal(days * 24 * 60, minutes, `${name}: ${days} days`);
  }
});

test("TypeScript is left out: it moves by the TypeScript 7 plan, not by Dependabot", () => {
  assert.match(entries.get("npm"), /ignore:\n(?:\s+#.*\n)*\s+- dependency-name: typescript\n/);
});
