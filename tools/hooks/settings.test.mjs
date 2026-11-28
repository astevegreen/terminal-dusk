// Tests for the web, gh and git-hook rules in .claude/settings.json, the night shift's web block and the agents' own tool limits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { LOCKED, UNATTENDED_LOCKED } from "./shared.mjs";

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
  // Setting or unsetting core.hooksPath asks in every spelling git takes, -C, --git-dir, -ccore.hooksPath and
  // --config-env included; reading it doesn't (the owner's change, 28 Nov 2026).
  const patterns = ["git commit *--no-verify*", "git commit -n *", "git push *--no-verify*", "git -C * push *--no-verify*", "git -c core.hooksPath*",
    "git *config *core.hooksPath *", "git *config *unset*core.hooksPath*", "git *-c core.hooksPath*", "git *-ccore.hooksPath*", "git *--config-env*core.hooksPath*"];
  const rules = [...patterns.map((p) => `Bash(${p})`), ...[...patterns, "git commit * -n *"].map((p) => `PowerShell(${p})`)];
  for (const rule of rules) {
    assert.ok(ask.includes(rule), `${rule} is missing from the ask list`);
    assert.ok(!allow.includes(rule), `${rule} is on the allow list`);
  }
  // `git config core.hooksPath*` also asked on the plain read `git config core.hooksPath`.
  for (const rule of ["Bash(git config core.hooksPath*)", "PowerShell(git config core.hooksPath*)"])
    assert.ok(!ask.includes(rule), `${rule} still asks on a read`);
});

// P6: what takes effect before any audit runs is guarded where it is written. Settings and the hooks they wire act on
// the session itself, so by day their edits ask the owner. CI workflows act once pushed, with the repository's
// secrets, which the owner keeps: an unattended session can't write them at all (file-lock, bash-guard --unattended),
// while a day session, with the owner there, may, and the rail audit checks them at pull-request time.
test("edits ask the owner by day only for settings and the hooks they wire (P6)", () => {
  const { ask } = permissions();
  const edits = ask.filter((r) => r.startsWith("Edit("));
  assert.deepEqual(edits, ["Edit(/.claude/settings.json)", "Edit(/.claude/settings.local.json)", "Edit(/tools/hooks/**)"]);
  const wired = [...JSON.stringify(JSON.parse(read(".claude/settings.json")).hooks).matchAll(/CLAUDE_PROJECT_DIR\}\/([^"]+)/g)];
  assert.ok(wired.length > 0);
  for (const [, script] of wired)
    assert.ok(script.startsWith("tools/hooks/"), `${script} is wired by settings.json but not covered by Edit(/tools/hooks/**)`);
});

test("CI workflows, which run with the repository's secrets once pushed, are Locked for unattended sessions (P6)", () => {
  assert.ok(UNATTENDED_LOCKED.includes(".github/workflows/"), "an unattended lane could push a workflow that reads the secrets");
  assert.ok(!LOCKED.includes(".github/workflows/"), "by day the owner is in the session; the rail audit checks workflows");
  const workflows = readdirSync(path.join(ROOT, ".github", "workflows"));
  const usesSecrets = workflows.filter((f) => /\$\{\{\s*secrets\./.test(read(`.github/workflows/${f}`)));
  assert.ok(usesSecrets.length > 0, "no workflow reads a secret: this test no longer says why workflows are Locked");
  // The unattended sessions run the guard that enforces it.
  assert.match(read(".claude/agents/implementer.md"), /tools\/hooks\/file-lock\.mjs"/);
  for (const file of [".claude/agents/implementer.md", ".claude/skills/sprint-lane/SKILL.md", ".claude/skills/night-shift/SKILL.md"])
    assert.match(read(file), /tools\/hooks\/bash-guard\.mjs" --unattended/, file);
});

test("marking a pull request ready and turning on auto-merge run without asking", () => {
  const { allow } = permissions();
  for (const rule of ["Bash(gh pr ready *)", "Bash(gh pr merge * --auto --squash)"]) assert.ok(allow.includes(rule), `${rule} is missing`);
});

test("a cloud session pushes its claude/* branch and reads PR checks without asking; main stays denied", () => {
  const { allow, deny } = permissions();
  // Cloud sessions run in the default mode with only this file, and their branches are claude/*.
  const rules = ["Bash(git push -u origin claude/*)", "Bash(git push origin claude/*)", "Bash(gh pr checks *)", "Bash(gh pr diff *)", "Bash(gh run view *)", "Bash(gh run list *)"];
  for (const rule of rules) assert.ok(allow.includes(rule), `${rule} is missing`);
  for (const rule of ["Bash(git push origin main)", "Bash(git push --force *)"]) assert.ok(deny.includes(rule), `${rule} is no longer denied`);
});

test("the handoff hook runs when a turn ends and when a session starts or is cleared", () => {
  const { hooks } = JSON.parse(read(".claude/settings.json"));
  const runs = (groups) => groups.some((g) => g.hooks.some((h) => h.args?.some((a) => a.endsWith("tools/hooks/handoff-nudge.mjs"))));
  assert.ok(runs(hooks.Stop), "handoff-nudge.mjs is missing from Stop");
  const starts = hooks.SessionStart.filter((g) => runs([g])).map((g) => g.matcher);
  assert.deepEqual(starts, ["startup|clear"]);
});

for (const agent of ["implementer", "reviewer", "architect"]) {
  test(`the ${agent} agent can't use the web at all`, () => {
    const tools = disallowedTools(agent);
    assert.ok(tools.includes("WebSearch") && tools.includes("WebFetch"), `disallowedTools: ${tools.join(", ")}`);
  });
}

test("history-rewriting git, the web downloaders and publishing are denied in Bash and in PowerShell alike", () => {
  const { deny } = permissions();
  // PowerShell has no bash-guard behind it, so its deny list is the only stop there; `git -C <dir>` spells the same
  // commands from another folder.
  const git = ["push --force *", "push -f *", "push origin main", "push origin main *", "reset --hard *", "clean *", "rebase *", "filter-branch *", "filter-repo *"];
  const commands = [...git.flatMap((g) => [`git ${g}`, `git -C * ${g}`]), "curl *", "wget *", "npx *", "pnpm dlx *", "npm publish *", "pnpm publish *"];
  for (const command of commands)
    for (const shell of ["Bash", "PowerShell"]) assert.ok(deny.includes(`${shell}(${command})`), `${shell}(${command}) is not denied`);
  // Every Bash deny has its PowerShell twin, so a rule added later can't be left for one shell only.
  for (const rule of deny.filter((r) => r.startsWith("Bash(")))
    assert.ok(deny.includes(rule.replace(/^Bash/, "PowerShell")), `${rule} has no PowerShell twin`);
});
