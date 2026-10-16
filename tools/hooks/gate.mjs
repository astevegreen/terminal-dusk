// Stop (and the implementer's SubagentStop): run `pnpm gate` before Claude may finish.
// 1. Skips at once when the session changed nothing, or nothing since the last green run.
// 2. On failure, blocks finishing (exit 2) with at most 40 lines of failures.
// 3. After 5 blocks in a row it tells Claude to report STATUS: GATE-FAILED, then lets it stop.
// It never changes files in the repository.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readInput, git, limitLines } from "./shared.mjs";

const MAX_BLOCKS = 5;
const input = await readInput();
const cwd = input.cwd ?? process.cwd();
const root = git(["rev-parse", "--show-toplevel"], cwd);
if (!root) process.exit(0); // not a git repository: nothing to check

const stateDir = path.join(os.tmpdir(), "terminal-dusk-gate");
mkdirSync(stateDir, { recursive: true });
const key = createHash("sha256").update(`${input.session_id ?? "none"}|${input.agent_id ?? ""}|${root}`).digest("hex").slice(0, 16);
const stateFile = path.join(stateDir, `${key}.json`);
const state = (() => {
  try { return JSON.parse(readFileSync(stateFile, "utf8")); } catch { return { blocks: 0, green: null }; }
})();
const save = () => writeFileSync(stateFile, JSON.stringify(state));

// What the session changed: uncommitted work, plus commits not yet on origin/main.
const status = git(["status", "--porcelain", "--untracked-files=all"], root) ?? "";
const head = git(["rev-parse", "--verify", "-q", "HEAD"], root);
const base = ["origin/main", "main"].find((b) => git(["rev-parse", "--verify", "-q", b], root));
const ahead = head && base ? Number(git(["rev-list", "--count", `${base}..HEAD`], root) ?? 0) : head ? 1 : 0;
if (!status && !ahead) process.exit(0);

// Skip when nothing changed since the last green run (questions asked mid-task stay instant).
const fingerprint = (() => {
  const h = createHash("sha256").update(`${head}\n${status}\n`);
  h.update(git(["diff", "HEAD", "--no-ext-diff", "--binary"], root) ?? "");
  for (const line of status.split("\n").filter((l) => l.startsWith("??"))) {
    const f = path.join(root, line.slice(3));
    try { const s = statSync(f); h.update(`${f}:${s.size}:${s.mtimeMs}\n`); } catch {}
  }
  return h.digest("hex");
})();
if (state.green === fingerprint) process.exit(0);

if (state.blocks >= MAX_BLOCKS) {
  state.blocks = 0;
  save();
  process.exit(0);
}

const hasGate = (() => {
  try { return Boolean(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts?.gate); } catch { return false; }
})();
const pnpm = hasGate && spawnSync("pnpm --version", { shell: true, encoding: "utf8", windowsHide: true }).status === 0;
if (!pnpm) {
  const why = hasGate ? "pnpm is not installed or not on PATH" : "package.json has no gate script";
  process.stdout.write(JSON.stringify({ systemMessage: `Gate not run: ${why}. Changes in this session are unchecked.` }));
  process.exit(0);
}

const r = spawnSync("pnpm --silent gate", {
  cwd: root, shell: true, encoding: "utf8", timeout: 570_000, windowsHide: true,
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: process.env.CI ?? "" },
});
if (r.status === 0) {
  state.blocks = 0;
  state.green = fingerprint;
  save();
  process.exit(0);
}

state.blocks += 1;
save();
const output = r.error?.code === "ETIMEDOUT" ? "pnpm gate timed out after 9.5 minutes." : `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();
const header = state.blocks >= MAX_BLOCKS
  ? `The gate has failed ${MAX_BLOCKS} times in a row. Stop working on it now: finish with STATUS: GATE-FAILED and the failures below in your report.`
  : `The gate failed (attempt ${state.blocks} of ${MAX_BLOCKS}); you can't finish until it passes. Fix your change, not the check.`;
process.stderr.write(`${header}\n${limitLines(output || "pnpm gate failed with no output.", 40)}\n`);
process.exit(2);
