// Tests for CI's dependency check: the new-dependency report and failing only on a new high or critical advisory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { advisories, catalog, depChanges, manifests, newAdvisories, report } from "./deps-report.mjs";

function tree(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "deps-report-"));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), typeof text === "string" ? text : JSON.stringify(text));
  }
  return root;
}

const WORKSPACE = 'packages:\n  - packages/*\n\ncatalog:\n  vitest: ^5.0.0\n  "@types/react": ^19.0.0\n\nminimumReleaseAge: 10080\n';

test("manifests reads the root, every package and shell, and the pnpm catalog", () => {
  const root = tree({
    "package.json": { devDependencies: { prettier: "^3.0.0" } },
    "packages/engine/package.json": { dependencies: { zod: "^4.6.0" } },
    "shells/desktop/package.json": { dependencies: { electron: "^40.0.0" } },
    "pnpm-workspace.yaml": WORKSPACE,
  });
  assert.deepEqual(Object.fromEntries(manifests(root)), {
    "package.json devDependencies prettier": "^3.0.0",
    "packages/engine/package.json dependencies zod": "^4.6.0",
    "shells/desktop/package.json dependencies electron": "^40.0.0",
    "pnpm-workspace.yaml catalog vitest": "^5.0.0",
    "pnpm-workspace.yaml catalog @types/react": "^19.0.0",
  });
  assert.deepEqual(catalog(path.join(root, "nothing.yaml")), []);
});

test("depChanges lists what was added, removed and changed", () => {
  const base = new Map([
    ["a dependencies x", "^1.0.0"],
    ["a dependencies y", "^1.0.0"],
  ]);
  const head = new Map([
    ["a dependencies x", "^2.0.0"],
    ["a dependencies z", "^1.0.0"],
  ]);
  assert.deepEqual(depChanges(base, head), {
    added: [{ key: "a dependencies z", to: "^1.0.0" }],
    removed: [{ key: "a dependencies y", from: "^1.0.0" }],
    changed: [{ key: "a dependencies x", from: "^1.0.0", to: "^2.0.0" }],
  });
});

const auditJson = (...list) =>
  JSON.stringify({
    advisories: Object.fromEntries(
      list.map(([id, module_name, severity]) => [id, { id, module_name, severity, title: `${module_name} bug`, url: "u" }]),
    ),
  });

test("advisories reads pnpm audit's JSON, and nothing else", () => {
  assert.deepEqual(advisories(auditJson([1, "zod", "high"])), [
    { key: "1 zod", severity: "high", title: "zod bug", module: "zod", url: "u" },
  ]);
  assert.equal(advisories("ERR_PNPM_AUDIT_BAD_RESPONSE"), null);
  assert.equal(advisories("{}"), null);
});

test("only a high or critical advisory the base didn't have fails", () => {
  const base = advisories(auditJson([1, "zod", "high"]));
  const head = advisories(auditJson([1, "zod", "high"], [2, "left-pad", "critical"], [3, "tiny", "moderate"]));
  assert.deepEqual(newAdvisories(base, head).map((a) => a.key), ["2 left-pad"]);
  const r = report({ changes: { added: [], removed: [], changed: [] }, base, head });
  assert.equal(r.fail, true);
  assert.match(r.text, /- NEW critical: left-pad/);
  assert.match(r.text, /- known \(also on the base, or below high\): high: zod/);
});

test("an advisory main already has never fails an unrelated pull request", () => {
  const known = advisories(auditJson([1, "zod", "high"]));
  const r = report({ changes: { added: [], removed: [], changed: [] }, base: known, head: known });
  assert.equal(r.fail, false);
  assert.match(r.text, /No dependency added, removed or changed\./);
  assert.match(r.text, /No new high or critical advisory\./);
});

test("an audit that got no answer warns and passes: a machine failure retries next run", () => {
  const changes = { added: [{ key: "package.json dependencies x", to: "^1.0.0" }], removed: [], changed: [] };
  const r = report({ changes, base: null, head: advisories(auditJson()) });
  assert.equal(r.fail, false);
  assert.match(r.text, /- added: package.json dependencies x \^1\.0\.0/);
  assert.match(r.text, /Warning: pnpm audit gave no answer/);
});
