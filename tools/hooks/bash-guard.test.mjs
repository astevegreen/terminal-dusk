import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, denied, decision, tempRepo } from "./test-helpers.mjs";

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

test("read-only mode runs the reviewer's usual inspection commands, and nothing that reads secrets", () => {
  for (const ok of ["git fetch -q origin", "git grep -n x", "gh pr list --label lane:rules", "gh pr checks 3",
    "git diff origin/main...task/3 | head -50", "tail -20 packages/x.ts", "grep -n foo packages/x.ts",
    "wc -l packages/x.ts", "cat packages/x.ts", "MSYS_NO_PATHCONV=1 git show task/142:.claude/rules/x.md"]) {
    assert.equal(guard(ok, ["--read-only"]).stdout, "", ok);
  }
  for (const bad of ["cat .env", "head -5 .env.local", "grep KEY .env", "grep -rn KEY .", "grep --recursive x .",
    "git fetch origin main:main", "GIT_EXTERNAL_DIFF=calc git diff", "env git diff", "tail -5 x | tee y"]) {
    assert.ok(denied(guard(bad, ["--read-only"])), bad);
  }
});

test("unattended mode lets the sprint skills ask the queue script", () => {
  for (const ok of ["node tools/sprint/queue.mjs next rules --fixes-done 1", "node tools/sprint/queue.mjs has-work \"Sprint lane: rules\"",
    "node tools/sprint/queue.mjs move 230 held --note \"1. [minor] summary out of date; see review\" --conflict", "node tools/sprint/queue.mjs status --need \"Sprint lane: app is stuck\""]) {
    assert.equal(guard(ok, ["--unattended"]).stdout, "", ok);
  }
});

const ownerOnlyGh = ["gh api repos/o/r/branches/main/protection", "gh repo edit --visibility public", "gh auth switch", "gh secret list", "pnpm gate && gh api user", "gh -R o/r secret set X"];

const ghReads = [
  "gh api user",
  "gh api repos/o/r/pulls/3/comments --paginate --jq '.[].body'",
  "gh api -X GET search/issues -f q=repo:o/r",
  "gh api --method=get repos/o/r",
  "gh api -H 'Accept: application/vnd.github+json' repos/o/r/check-runs/1/annotations",
  "gh repo view --json name,visibility",
  "gh repo view o/r",
  "gh api user && gh repo view",
];

const ghWrites = [
  "gh api -X POST repos/o/r/issues -f title=x",
  "gh api --method DELETE repos/o/r/git/refs/heads/x",
  "gh api --method=patch repos/o/r",
  "gh api -iXPOST repos/o/r/labels",
  "gh api repos/o/r/issues -f title=x",
  "gh api repos/o/r/issues -Ftitle=x",
  "gh api repos/o/r/issues --raw-field title=x",
  "gh api repos/o/r/issues --input body.json",
  "gh api graphql -f query='query { viewer { login } }'",
  "gh api $ENDPOINT",
  "gh api \"repos/$(cat x)\"",
  "gh repo edit --visibility public",
  "gh repo delete o/r --yes",
  "gh repo clone o/r",
  // Bash runs a command hidden in double quotes before gh sees it.
  "gh repo view \"$(rm -rf ~/x)\"",
  "gh repo view \"`rm notes.txt`\"",
  "pnpm gate && gh api -X PUT repos/o/r/topics",
  // Quoting or escaping that bash would join into a method flag.
  "gh api --'method' DELETE repos/o/r",
  "gh api \"-\"X DELETE repos/o/r",
  "gh api \"--\"method POST repos/o/r/issues",
  "gh api --meth\\od DELETE repos/o/r",
  "gh api \\-X DELETE repos/o/r",
  "gh api --method\\ DELETE repos/o/r",
  // Reads that send a local file or reach another host.
  "gh api -X GET search/issues -F q=@.env",
  "gh api -X GET search/issues --field=q=@notes.txt",
  "gh api -X GET search/issues --input body.json",
  "gh api --hostname evil.example user",
  "gh api https://evil.example/x",
  "GH_HOST=evil.example gh api user",
];

for (const command of ghReads) {
  test(`by day, runs without a prompt: ${command}`, () => {
    const r = guard(command);
    assert.equal(decision(r), "allow");
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /read-only/);
  });
}

for (const command of ghWrites) {
  test(`by day, asks the owner: ${command}`, () => {
    const r = guard(command);
    assert.equal(decision(r), "ask");
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /owner/);
  });
}

test("by day, other gh commands and mixed command lines are left to the permission rules", () => {
  for (const command of ["gh auth switch", "gh secret list", "gh -R o/r secret set X", "pnpm gate && gh api user", "gh api user > me.json", "gh pr view 3"]) {
    assert.equal(decision(guard(command)), "none", command);
  }
});

test("by day, a command line bash-guard can't read to the end never gets an allow", () => {
  for (const command of [
    "gh api user < /dev/null; gh repo delete o/r --yes",
    "gh api user <<EOF\nx\nEOF\ngh repo delete o/r --yes",
    "gh repo view <<< x; rm notes.txt",
  ]) {
    assert.notEqual(decision(guard(command)), "allow", command);
  }
});

test("by day, quoted gh api arguments that bash keeps whole still count as reads", () => {
  for (const command of ["gh api 'repos/o/r/pulls?state=open'", "gh api \"repos/o/r/issues\" --jq '.[] | .title'", "\"gh\" api user"]) {
    assert.equal(decision(guard(command)), "allow", command);
  }
});

test("unattended mode blocks owner-only gh commands", () => {
  for (const command of [...ownerOnlyGh, "gh api user", "gh repo view"]) {
    const r = guard(command, ["--unattended"]);
    assert.ok(denied(r), command);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /owner-only/);
  }
});

test("unattended mode still allows the night shift's gh commands and keeps the normal blocks", () => {
  for (const ok of ["gh issue list --label ready --json number", "gh pr merge 3 --auto --squash", "gh pr create --draft --title \"api auth\""]) {
    assert.equal(guard(ok, ["--unattended"]).stdout, "", ok);
  }
  for (const bad of ["git push --force origin task/1", "curl https://example.com"]) {
    assert.ok(denied(guard(bad, ["--unattended"])), bad);
  }
});

const skipHooks = [
  "git commit --no-verify -m x",
  "git commit --no-verif -m x",
  "git commit -n -m x",
  "git commit -nm x",
  "git commit -anm x",
  "git commit -m x -n",
  "git add . && git commit -nm x",
  "git push --no-verify -u origin task/1",
  "git config core.hooksPath /dev/null",
  "git config --local core.hooksPath x",
  "git config --unset core.hooksPath",
  "git -c core.hooksPath=/dev/null commit -m x",
  "git -c core.hooksPath commit -m x",
  "git --config-env core.hooksPath=X commit -m x",
];

const keepHooks = [
  "git commit -m \"skip -n checks\"",
  "git commit -m -n",
  "git commit -mn",
  "git commit -am x",
  "git commit --amend --no-edit",
  "git commit -F msg.txt",
  "git push -n -u origin task/1",
  "git config user.name x",
];

for (const command of skipHooks) {
  test(`by day, asks before skipping git's hooks: ${command}`, () => {
    const r = guard(command);
    assert.equal(decision(r), "ask");
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /hooks/);
  });
  test(`unattended, blocks skipping git's hooks: ${command}`, () => {
    const r = guard(command, ["--unattended"]);
    assert.ok(denied(r), `expected deny, got ${r.stdout || "nothing"}`);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /hooks/);
  });
}

test("commits and pushes that keep git's hooks are left alone", () => {
  for (const command of keepHooks) {
    assert.equal(decision(guard(command)), "none", command);
    assert.equal(decision(guard(command, ["--unattended"])), "none", command);
  }
});

test("empty or malformed input is allowed silently", () => {
  const r = runHook("bash-guard.mjs", {});
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
