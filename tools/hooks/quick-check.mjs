// PostToolUse (Edit|Write): fast checks on the one file just edited.
// Lints code, validates card and scenario JSON, and flags files over 350 lines.
// Silent when everything passes; otherwise up to 20 lines go back to Claude (exit 2).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readInput, repoRootFor, toPosix, limitLines } from "./shared.mjs";

const MAX_LINES = 350;
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

const input = await readInput();
const file = input.tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);

const root = repoRootFor(file, input.cwd ?? process.cwd());
const rel = toPosix(path.relative(root, file));
const problems = [];

// 1. Lint the file with the repo's own ESLint, when it is installed.
const eslint = path.join(root, "node_modules", "eslint", "bin", "eslint.js");
if (CODE.test(file) && existsSync(eslint)) {
  const r = spawnSync(process.execPath, [eslint, "--format", "json", "--no-warn-ignored", file], {
    cwd: root, encoding: "utf8", timeout: 45_000, windowsHide: true,
  });
  try {
    for (const result of JSON.parse(r.stdout)) {
      for (const m of result.messages.filter((m) => m.severity === 2)) {
        problems.push(`${rel}:${m.line ?? 0} ${m.message}${m.ruleId ? ` (${m.ruleId})` : ""}`);
      }
    }
  } catch {
    if (r.status !== 0 && r.status !== 1) problems.push(`${rel}: eslint failed to run: ${(r.stderr || "").trim().split("\n")[0]}`);
  }
}

// 2. Card, map and scenario JSON: must parse, then pass the content schema check.
if (/^packages\/content\/.*\.json$/i.test(rel)) {
  const text = readFileSync(file, "utf8");
  try {
    JSON.parse(text);
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    if (pkg.scripts?.["content:check"]) {
      // content:check accepts optional file paths and then checks only those files.
      const r = spawnSync(`pnpm --silent run content:check "${rel}"`, {
        cwd: root, encoding: "utf8", shell: true, timeout: 45_000, windowsHide: true,
      });
      if (r.status !== 0) problems.push(...`${r.stdout}\n${r.stderr}`.trim().split(/\r?\n/).filter(Boolean));
    }
  } catch (err) {
    const pos = /position (\d+)/.exec(err.message);
    const line = pos ? text.slice(0, Number(pos[1])).split("\n").length : 1;
    problems.push(`${rel}:${line} ${err.message}`);
  }
}

// 3. File size.
if (CODE.test(file)) {
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines > MAX_LINES) problems.push(`${rel} is ${lines} lines (limit about ${MAX_LINES}). Split it by responsibility.`);
}

if (problems.length) {
  process.stderr.write(limitLines(`quick-check found problems in ${rel}:\n${problems.join("\n")}`, 20) + "\n");
  process.exit(2);
}
