// Shared helpers for the hook tests (tools/hooks/*.test.mjs).
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const HOOKS = import.meta.dirname;

// Run a hook script with `input` as its stdin JSON, the way Claude Code does.
export function runHook(script, input, { args = [], env = {} } = {}) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, script), ...args], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  let json = null;
  try { json = r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch {}
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

export const denied = (r) => r.json?.hookSpecificOutput?.permissionDecision === "deny";

export function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

// A throwaway git repository on branch main with one commit.
export function tempRepo(files = {}) {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "td-hook-test-")));
  sh("git", ["init", "-q", "-b", "main"], dir);
  sh("git", ["config", "user.email", "test@example.com"], dir);
  sh("git", ["config", "user.name", "Test"], dir);
  sh("git", ["config", "commit.gpgsign", "false"], dir);
  writeFiles(dir, { "README.md": "test\n", ...files });
  sh("git", ["add", "-A"], dir);
  sh("git", ["commit", "-q", "-m", "init"], dir);
  return dir;
}

export function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}
