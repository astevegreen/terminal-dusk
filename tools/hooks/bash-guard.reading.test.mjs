// How bash-guard reads a command line: the commands bash runs wherever they hide, and the text it never runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, denied, decision, tempRepo } from "./test-helpers.mjs";

const repo = tempRepo();
const guard = (command, args = []) => runHook("bash-guard.mjs", { cwd: repo, tool_name: "Bash", tool_input: { command } }, { args });

// Bash runs these force pushes, so every mode must see them: inside double quotes, after a newline or a
// here-document, behind an input redirect, a comment line, a line continuation, a case pattern, or a word such
// as `{`, `!`, `coproc`, `function f {` or `time -p`.
const hidden = [
  "node tools/sprint/queue.mjs move 230 held --note \"see `git push --force origin task/1`\"",
  "gh pr comment 3 --body \"$(git push --force origin task/1)\"",
  "echo \"$(git push origin \"main\")\"",
  "echo \"${X:-$(git push --force origin task/1)}\"",
  "echo $((1 + $(git push --force origin task/1)))",
  "echo $(echo $(git push --force origin task/1))",
  "diff <(git push --force origin task/1) x",
  "cat <<< \"$(git push --force origin task/1)\"",
  "cat <<EOF\n$(git push --force origin task/1)\nEOF",
  "cat <<EOF\nx\nEOF\ngit push --force origin task/1",
  "echo \"$(cat <<'EOF'\nx\nEOF\n)\" && git push --force origin task/1",
  "echo hi < /dev/null; git push --force origin task/1",
  "echo hi\ngit push --force origin task/1",
  "# don't\ngit push --force origin task/1",
  "git push \\\n  --force origin task/1",
  "git push --fo\\\nrce origin task/1",
  "{ git push --force origin task/1; }",
  "if true; then git push --force origin task/1; fi",
  "while true; do git push --force origin task/1; done",
  "! git push --force origin task/1",
  "gh pr comment 3 --body \"$(case x in x) git push --force origin task/1;; esac)\"",
  "cat <<EOF\n$(case x in x) git push --force origin task/1;; esac)\nEOF",
  "coproc git push --force origin task/1",
  "coproc job { git push --force origin task/1; }",
  "function f { git push --force origin task/1; }",
  "time -p git push --force origin task/1",
  "env -i git push --force origin task/1",
];

for (const command of hidden) {
  for (const args of [[], ["--unattended"], ["--read-only"]]) {
    test(`blocks ${args[0] ?? "by day"}: ${JSON.stringify(command)}`, () => {
      const r = guard(command, args);
      assert.ok(denied(r), `expected deny, got ${r.stdout || "nothing"}`);
    });
  }
}

test("reading .env through an input redirect is blocked in every mode", () => {
  for (const args of [[], ["--unattended"], ["--read-only"]]) {
    for (const command of ["cat < .env", "grep KEY < .env.local", "node x.mjs 0< .env"]) assert.ok(denied(guard(command, args)), `${args} ${command}`);
  }
});

// Text bash treats as text: single quotes, an escaped $ or backtick, a quoted here-document's body, a comment.
const literal = [
  "node tools/sprint/queue.mjs move 230 held --note 'see `git push --force origin task/1`'",
  "node tools/sprint/queue.mjs move 230 held --note 'see $(git push --force origin task/1)'",
  "node tools/sprint/queue.mjs move 230 held --note \"see \\$(git push --force origin task/1)\"",
  "node tools/sprint/queue.mjs move 230 held --note \"see \\`git push --force origin task/1\\`\"",
  "node tools/sprint/queue.mjs move 230 held --note \"never git push --force origin main; ask\"",
  "git commit -m \"$(cat <<'EOF'\nRefuse git push --force origin main; don't (ever)\n\nCo-Authored-By: x\nEOF\n)\"",
  "gh pr create --draft --title x --body \"$(cat <<'EOF'\n## Summary\n- `git push --force` and $(rm -rf /) are refused\nEOF\n)\"",
  "cat <<'EOF'\ngit push --force origin task/1\nEOF",
  "cat <<\"EOF\"\n$(git push --force origin task/1)\nEOF",
  "echo hi # git push --force origin task/1",
  "echo 'a\ngit push --force origin task/1' && pnpm gate",
  "pnpm gate 2>&1 | tail -20",
];

test("text bash never runs is not mistaken for a command, by day or unattended", () => {
  for (const command of literal) {
    assert.equal(decision(guard(command)), "none", command);
    assert.equal(decision(guard(command, ["--unattended"])), "none", command);
  }
});

test("read-only mode checks the commands inside double quotes and substitutions too", () => {
  for (const bad of ["git log --format=\"$(rm -rf x)\"", "git show \"`touch x`\"", "cat <(rm -rf x)", "git status\nrm -rf x",
    "git diff $(git commit -m x)", "cat <<EOF\n$(rm -rf x)\nEOF"]) {
    assert.ok(denied(guard(bad, ["--read-only"])), bad);
  }
  for (const ok of ["git log --format=\"%h %s\"", "git log --format='$(x)'", "grep -n \"\\$(\" packages/x.ts", "git diff \"$(git log -1 --format=%H)\"",
    "cat < packages/x.ts", "git status 2>&1"]) {
    assert.equal(guard(ok, ["--read-only"]).stdout, "", ok);
  }
});

test("by day, gh reads still run without a prompt when written over several lines", () => {
  for (const command of ["gh api user\ngh repo view", "gh api \\\n  repos/o/r", "gh api user # who am I"]) {
    assert.equal(decision(guard(command)), "allow", JSON.stringify(command));
  }
  assert.equal(decision(guard("gh api user\ngh repo delete o/r --yes")), "ask");
});

test("by day, a line that ends inside a quote or a substitution never gets an allow", () => {
  for (const command of ["gh api user \"x", "gh api user $(echo", "gh api user <<EOF\nx", "gh api user 'x"]) {
    assert.notEqual(decision(guard(command)), "allow", JSON.stringify(command));
  }
});
