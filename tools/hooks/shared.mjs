// Helpers shared by the Claude Code hook scripts. No dependencies; Node built-ins only.
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

// Locked paths, relative to the repository (or worktree) root. Keep in sync with
// CLAUDE.md "Never", the `ask` rules in .claude/settings.json and .github/CODEOWNERS.
export const LOCKED = [
  ".claude/",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/",
  "docs/architecture.md",
  "tools/hooks/",
  "tools/gates/",
];

// Claude Code keeps its own worktrees under .claude/worktrees/; files there belong to the worktree.
const NOT_LOCKED = [".claude/worktrees/"];

export async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function toPosix(p) {
  return p.replace(/\\/g, "/");
}

const caseless = process.platform === "win32" || process.platform === "darwin";
const fold = (p) => (caseless ? p.toLowerCase() : p);

export function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Resolve symlinks and Windows short names (C:\Users\RUNNER~1) in the part of `p` that exists,
// so paths compare equal to the long form git reports.
export function canonical(p) {
  let dir = path.resolve(p);
  const rest = [];
  while (!existsSync(dir)) {
    const up = path.dirname(dir);
    if (up === dir) break;
    rest.unshift(path.basename(dir));
    dir = up;
  }
  try { dir = realpathSync.native(dir); } catch {}
  return path.join(dir, ...rest);
}

function existingDir(p) {
  let dir = path.resolve(p);
  while (!(existsSync(dir) && statSync(dir).isDirectory())) {
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return dir;
}

// The git root that owns `target`: the worktree's own root inside a worktree.
// Outside any repository it returns `fallback`, or null when no fallback is given.
export function repoRootFor(target, fallback) {
  const root = git(["rev-parse", "--show-toplevel"], existingDir(target)) ?? fallback;
  return root ? canonical(root) : null;
}

// Returns the locked entry `file` falls under, or null.
export function lockedEntry(file, cwd) {
  if (!file) return null;
  const abs = canonical(path.resolve(cwd ?? process.cwd(), file));
  const root = repoRootFor(abs, cwd ?? process.cwd());
  const rel = fold(toPosix(path.relative(root, abs)));
  if (rel.startsWith("../") || path.isAbsolute(rel)) return null;
  if (NOT_LOCKED.some((n) => rel.startsWith(fold(n)))) return null;
  return LOCKED.find((l) => (l.endsWith("/") ? rel.startsWith(fold(l)) : rel === fold(l))) ?? null;
}

export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

export function limitLines(text, max) {
  const lines = text.trimEnd().split(/\r?\n/);
  if (lines.length <= max) return lines.join("\n");
  return [...lines.slice(0, max - 1), `... (${lines.length - max + 1} more lines)`].join("\n");
}
