import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, denied, tempRepo } from "./test-helpers.mjs";

const repo = tempRepo();
const guard = (command, args = []) => runHook("bash-guard.mjs", { cwd: repo, tool_name: "Bash", tool_input: { command } }, { args });

const blocked = [
  "git push --force origin task/1",
  "git push --force-with-lease origin task/1",
  "git status && git push -f",
  "git push origin +task/1",
  "git push origin main",
  "git push origin HEAD:main",
  "git push",
  "git -C . reset --hard HEAD~1",
  "echo hi; git clean -fdx",
  "git rebase main",
  "git filter-branch --tree-filter x",
  "rm -rf ../elsewhere",
  "rm -rf /",
  "Remove-Item -Recurse -Force C:\\Windows\\Temp\\x",
  "echo x > CLAUDE.md",
  "echo x >> .claude/settings.json",
  "echo x | tee tools/hooks/bash-guard.mjs",
  "cp evil.yml .github/workflows/ci.yml",
  "sed -i s/a/b/ docs/architecture.md",
  "Set-Content tools/gates/gate.mjs 'x'",
  "rm CLAUDE.md",
  "curl https://example.com",
  "pnpm gate && wget https://example.com",
  "Invoke-WebRequest https://example.com",
  "iwr https://example.com -OutFile x",
  "irm https://example.com",
  "cat .env",
  "type .env.local",
  "Get-Content .env",
];

const allowed = [
  "pnpm gate",
  "pnpm test --filter engine",
  "git status",
  "git diff origin/main...HEAD",
  "git push -u origin task/12",
  "git commit -m \"Fix scoring; add test\"",
  "rm -rf dist node_modules/.cache",
  "echo x > notes.txt",
  "echo x > /dev/null",
  "node tools/gates/gate.mjs 2>&1",
  "gh pr create --draft --title \"Push > pull\"",
  "cat README.md",
];

for (const command of blocked) {
  test(`blocks: ${command}`, () => {
    const r = guard(command);
    assert.ok(denied(r), `expected deny, got ${r.stdout || "nothing"}`);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /^Blocked by bash-guard: .+/);
  });
}

for (const command of allowed) {
  test(`allows: ${command}`, () => {
    const r = guard(command);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "", `expected silence, got ${r.stdout}`);
  });
}

test("read-only mode allows only inspection commands", () => {
  for (const ok of ["git diff origin/main...task/3", "git log --oneline -5", "git show HEAD", "git status", "gh issue view 3", "gh pr view 3 --comments", "gh pr diff 3"]) {
    assert.equal(guard(ok, ["--read-only"]).stdout, "", ok);
  }
  for (const bad of ["git commit -m x", "git diff > out.txt", "git log --output=x", "git -c core.pager=x log", "ls", "git status && rm -rf x", "gh pr merge 3"]) {
    assert.ok(denied(guard(bad, ["--read-only"])), bad);
  }
});

test("empty or malformed input is allowed silently", () => {
  const r = runHook("bash-guard.mjs", {});
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
