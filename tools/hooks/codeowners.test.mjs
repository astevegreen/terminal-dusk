// .github/CODEOWNERS must keep the fences, database migrations and dependency files waiting for the owner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LOCKED } from "./shared.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const lines = readFileSync(path.join(ROOT, ".github/CODEOWNERS"), "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
const owned = new Map(lines.map((l) => l.trim().split(/\s+/)).map(([p, ...owners]) => [p, owners]));

test("every Locked path is code-owned", () => {
  for (const entry of LOCKED) assert.ok(owned.has(`/${entry}`), `/${entry} is missing from CODEOWNERS`);
});

test("database migrations, dependencies and tool settings are code-owned", () => {
  for (const p of [
    "/packages/server/supabase/migrations/", "/tools/git-hooks/", "**/package.json", "/pnpm-lock.yaml",
    "/pnpm-workspace.yaml", "**/tsconfig*.json", "**/vitest.config.*", "**/vite.config.*", "/eslint.config.*",
  ]) assert.ok(owned.has(p), `${p} is missing from CODEOWNERS`);
});

test("every entry names the owner", () => {
  for (const [p, owners] of owned) assert.deepEqual(owners, ["@astevegreen"], p);
});
