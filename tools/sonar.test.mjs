import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { report } from "./sonar.mjs";
import { decision, runHook } from "./hooks/test-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const SHA = "71883034921adc52a93a073e2986ba22aa773a9d";
const summary = (issues) =>
  `Issues  \n![](https://x/passed.svg '') [${issues} New issues](https://sonarcloud.io/a)  \n` +
  "![](https://x/accepted.svg '') [0 Accepted issues](https://sonarcloud.io/b)\n\nMeasures  \n" +
  "![](https://x/passed.svg '') [0 Security Hotspots](https://sonarcloud.io/c)  \n" +
  "![](https://x/passed.svg '') [0.0% Coverage on New Code](https://sonarcloud.io/d)  \n  \n" +
  "[See analysis details on SonarQube Cloud](https://sonarcloud.io/e)\n\n";

const sonarRun = ({ issues = 0, ...over } = {}) => ({
  id: 7,
  name: "SonarCloud Code Analysis",
  app: { slug: "sonarqubecloud" },
  status: "completed",
  conclusion: "success",
  output: { title: "Quality Gate passed", summary: summary(issues) },
  ...over,
});
const finding = (file, title, line = 0, key = "K1") => ({
  path: file,
  start_line: line,
  title,
  message: `\nSee more on https://sonarcloud.io/project/issues?id=p&issues=${key}&open=${key}&pullRequest=246`,
});

// A stand-in for gh: answers the three calls report() makes and records them.
function fakeGh({ findings = [], runs = [sonarRun({ issues: findings.length })], fail } = {}) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (fail) throw new Error(fail);
    if (args[0] === "pr") return JSON.stringify({ number: 246, headRefOid: SHA });
    if (args.some((a) => a.includes("/check-runs?")))
      return JSON.stringify({ check_runs: [{ id: 1, name: "gate", app: { slug: "github-actions" } }, ...runs] });
    return findings.map((f) => JSON.stringify(f)).join("\n");
  };
  return { gh, calls };
}

test("a finished check prints the quality gate, the counts and every finding grouped by message", () => {
  const { gh } = fakeGh({
    findings: [
      finding("cards/a.test.ts", "Add some tests to this file or delete it.", 0, "A1"),
      finding("src/sort.ts", "Provide a compare function.", 12, "B1"),
      finding("cards/b.test.ts", "Add some tests to this file or delete it.", 0, "A2"),
    ],
  });
  const r = report("246", { gh });
  assert.equal(r.code, 0, r.out);
  assert.equal(
    r.out,
    [
      "SonarCloud on PR #246 (commit 7188303): Quality Gate passed",
      "3 New issues · 0 Accepted issues · 0 Security Hotspots · 0.0% Coverage on New Code",
      "",
      "2 × Add some tests to this file or delete it.",
      "  cards/a.test.ts  (issue A1)",
      "  cards/b.test.ts  (issue A2)",
      "1 × Provide a compare function.",
      "  src/sort.ts:12  (issue B1)",
    ].join("\n"),
  );
});

test("it asks gh for the PR's latest commit, that commit's checks, and every page of findings", () => {
  const { gh, calls } = fakeGh();
  report("#246", { gh });
  assert.deepEqual(calls[0], ["pr", "view", "246", "--json", "number,headRefOid"]);
  assert.deepEqual(calls[1], ["api", `repos/{owner}/{repo}/commits/${SHA}/check-runs?per_page=100`]);
  assert.deepEqual(calls[2], [
    "api",
    "--paginate",
    "repos/{owner}/{repo}/check-runs/7/annotations?per_page=100",
    "--jq",
    ".[]",
  ]);
  assert.ok(calls.every((c) => !c.some((a) => /^(-X|--method|-f|-F|--field|--raw-field|--input)$/.test(a))));
});

test("when GitHub holds fewer findings than SonarCloud counted, it says the list is incomplete", () => {
  const r = report("246", fakeGh({ runs: [sonarRun({ issues: 5 })], findings: [finding("a.ts", "Fix this.")] }));
  assert.equal(r.code, 0);
  assert.match(r.out, /\n\nGitHub has 1 of SonarCloud's 5 new issues\. The rest are only on sonarcloud\.io/);
});

test("with no findings it says so", () => {
  const r = report("246", fakeGh());
  assert.equal(r.code, 0);
  assert.match(r.out, /Quality Gate passed\n.*\n\nNo findings\.$/);
});

test("stray brackets before a count neither swallow it nor slow the read down", () => {
  const stray = "[".repeat(20000);
  const run = sonarRun({ output: { title: "Quality Gate passed", summary: `${stray}[1 New issue](https://x)` } });
  const r = report("246", fakeGh({ runs: [run], findings: [finding("a.ts", "Fix this.")] }));
  assert.equal(r.out.split("\n")[1], "1 New issue");
});

test("when SonarCloud ran more than once on the commit, the newest run counts", () => {
  const old = sonarRun({ id: 5, output: { title: "Quality Gate failed", summary: "" } });
  const r = report("246", fakeGh({ runs: [old, sonarRun({ id: 9 })] }));
  assert.match(r.out, /Quality Gate passed/);
});

test("while SonarCloud is still running it says so and fails", () => {
  const r = report("246", fakeGh({ runs: [sonarRun({ status: "in_progress", conclusion: null })] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /still running on PR #246 \(in_progress\)/);
});

test("with no SonarCloud check on the PR's latest commit it says so and fails", () => {
  const r = report("246", fakeGh({ runs: [] }));
  assert.equal(r.code, 1);
  assert.match(r.out, /No SonarCloud check on PR #246's latest commit 7188303/);
});

test("when gh fails it passes gh's message on and fails", () => {
  const r = report("999", fakeGh({ fail: "no pull requests found" }));
  assert.equal(r.code, 1);
  assert.equal(r.out, "sonar: no pull requests found");
});

test("Claude runs it without asking the owner, by day and on the night shift", () => {
  const { allow } = JSON.parse(readFileSync(path.join(ROOT, ".claude/settings.json"), "utf8")).permissions;
  assert.ok(allow.includes("Bash(node tools/*)"), "node tools/* is not on the allow list");
  for (const args of [[], ["--unattended"]]) {
    const r = runHook("bash-guard.mjs", { tool_input: { command: "node tools/sonar.mjs 246" }, cwd: ROOT }, { args });
    assert.equal(decision(r), "none", `bash-guard ${args.join(" ")} stepped in: ${r.stdout}${r.stderr}`);
  }
});

test("without a pull request number it prints how to use it and fails", () => {
  for (const args of [[], ["main"], ["12a"]]) {
    const r = spawnSync(process.execPath, [path.join(import.meta.dirname, "sonar.mjs"), ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stdout, /usage: node tools\/sonar\.mjs <pull request number>/);
  }
});
