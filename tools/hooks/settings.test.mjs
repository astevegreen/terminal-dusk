// Tests for the web, gh and git-hook rules in .claude/settings.json, the night shift's web block and the agents' own tool limits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

function permissions() {
  try {
    return JSON.parse(read(".claude/settings.json")).permissions;
  } catch (err) {
    throw new Error(`.claude/settings.json is not strict JSON, so Claude Code would ignore it: ${err.message}`, { cause: err });
  }
}

function disallowedTools(agent) {
  const line = read(`.claude/agents/${agent}.md`).match(/^disallowedTools:(.*)$/m)?.[1] ?? "";
  return line.split(",").map((t) => t.trim()).filter(Boolean);
}

test("web searches run without asking the owner", () => {
  const { allow, ask, deny } = permissions();
  assert.ok(allow.includes("WebSearch"), "WebSearch is missing from the allow list");
  assert.ok(!ask.includes("WebSearch"), "WebSearch is still on the ask list");
  assert.ok(!deny.includes("WebSearch"), "WebSearch is on the deny list");
});

test("opening a web page runs without asking by day", () => {
  const { allow, ask, deny } = permissions();
  assert.ok(allow.includes("WebFetch"), "WebFetch is missing from the allow list");
  assert.ok(!ask.includes("WebFetch"), "WebFetch is still on the ask list");
  assert.ok(!deny.includes("WebFetch"), "WebFetch is on the deny list");
});

test("the night shift can't open web pages", () => {
  const front = read(".claude/skills/night-shift/SKILL.md").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  assert.match(front, /- matcher: "WebFetch"\s+hooks:\s+- type: command\s+command: node "\$CLAUDE_PROJECT_DIR\/tools\/hooks\/no-web\.mjs"/);
});

test("bash-guard decides gh api and gh repo; gh auth and gh secret always ask", () => {
  const { ask } = permissions();
  // An ask rule beats a hook's allow, so these must be off the list for bash-guard to let reads through.
  for (const rule of ["Bash(gh api *)", "Bash(gh repo *)"]) assert.ok(!ask.includes(rule), `${rule} is still on the ask list`);
  for (const rule of ["Bash(gh auth *)", "Bash(gh secret *)"]) assert.ok(ask.includes(rule), `${rule} is missing from the ask list`);
});

test("skipping git hooks always asks the owner, in Bash and in PowerShell", () => {
  const { allow, ask } = permissions();
  // `git commit *` is allowed, so without these `git commit --no-verify` would run unasked.
  // bash-guard catches the spellings these prefixes miss (git commit -anm, -m x -n); PowerShell has no
  // such hook, so it keeps the broader `* -n *`, which also asks when a message holds " -n ".
  const patterns = ["git commit *--no-verify*", "git commit -n *", "git push *--no-verify*", "git config core.hooksPath*", "git -c core.hooksPath*"];
  const rules = [...patterns.map((p) => `Bash(${p})`), ...[...patterns, "git commit * -n *"].map((p) => `PowerShell(${p})`)];
  for (const rule of rules) {
    assert.ok(ask.includes(rule), `${rule} is missing from the ask list`);
    assert.ok(!allow.includes(rule), `${rule} is on the allow list`);
  }
});

test("marking a pull request ready and turning on auto-merge run without asking", () => {
  const { allow } = permissions();
  for (const rule of ["Bash(gh pr ready *)", "Bash(gh pr merge * --auto --squash)"]) assert.ok(allow.includes(rule), `${rule} is missing`);
});

test("the handoff hook runs when a turn ends and when a session starts or is cleared", () => {
  const { hooks } = JSON.parse(read(".claude/settings.json"));
  const runs = (groups) => groups.some((g) => g.hooks.some((h) => h.args?.some((a) => a.endsWith("tools/hooks/handoff-nudge.mjs"))));
  assert.ok(runs(hooks.Stop), "handoff-nudge.mjs is missing from Stop");
  const starts = hooks.SessionStart.filter((g) => runs([g])).map((g) => g.matcher);
  assert.deepEqual(starts, ["startup|clear"]);
});

for (const agent of ["implementer", "reviewer"]) {
  test(`the ${agent} agent can't use the web at all`, () => {
    const tools = disallowedTools(agent);
    assert.ok(tools.includes("WebSearch") && tools.includes("WebFetch"), `disallowedTools: ${tools.join(", ")}`);
  });
}
