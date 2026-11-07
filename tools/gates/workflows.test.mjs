// The CI workflow's shape that merges depend on (owner's policy, 28 Oct 2026): the required "gate" job passes only
// when every other Linux job passed, so e2e, the database and the dependency check gate merges without a ruleset
// change; and a green nightly run closes the failure issue. Read as text: the repo has no YAML parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (file) => readFileSync(path.join(ROOT, ".github", "workflows", file), "utf8");

// Each job's id and its text, from the lines under `jobs:` indented by two spaces.
function jobs(yaml) {
  const out = new Map();
  let current = null;
  for (const line of yaml.slice(yaml.indexOf("\njobs:")).split(/\r?\n/).slice(2)) {
    const m = /^ {2}([\w-]+):\s*$/.exec(line);
    if (m) out.set((current = m[1]), "");
    else if (current) out.set(current, `${out.get(current)}${line}\n`);
  }
  return out;
}

test("the required gate job needs every other job but the Windows one, and fails unless each succeeded", () => {
  const ci = jobs(read("ci.yml"));
  const gate = ci.get("gate");
  assert.ok(gate, "ci.yml has no gate job, which the ruleset requires");
  const needs = /needs: \[([^\]]*)\]/.exec(gate)?.[1].split(",").map((s) => s.trim());
  const others = [...ci.keys()].filter((j) => !["gate", "tools-windows"].includes(j));
  assert.deepEqual(needs?.sort(), others.sort());
  assert.ok(others.includes("e2e") && others.includes("db") && others.includes("deps"), others.join(", "));
  assert.match(gate, /if: \$\{\{ !cancelled\(\) \}\}/, "without it a failed need skips gate, and a skipped check passes");
  assert.match(gate, /select\(\.value\.result != "success"\)/);
  assert.match(gate, /exit 1/);
});

// A job's steps, each as its text from its `      - ` line to the next.
const steps = (job) => job.split(/^(?= {6}- )/m).slice(1);
const name = (step) => /name: (.*)/.exec(step)?.[1].trim() ?? step.split("\n")[0].trim();

test("the gate, the test count and the full fuzz run in parallel, each its own job", () => {
  const ci = jobs(read("ci.yml"));
  const where = (pattern) => [...ci].filter(([, text]) => pattern.test(text)).map(([id]) => id);
  const homes = [/pnpm gate --all/, /tools\/gates\/test-count\.mjs --compare/, /pnpm run --if-present fuzz/].map(where);
  for (const home of homes) assert.equal(home.length, 1, `in ${home.length} jobs`);
  assert.equal(new Set(homes.flat()).size, 3, `one job holds two of them: ${homes.flat().join(", ")}`);
});

test("the test count fails closed: its job runs on every event, and on a push exits cleanly with nothing to compare", () => {
  const ci = jobs(read("ci.yml"));
  const [id, job] = [...ci].find(([, text]) => /test-count\.mjs --compare/.test(text));
  // A job skipped by a job-level `if:` counts as passing, so the job itself is never conditional.
  assert.doesNotMatch(job, /^ {4}if:/m, `${id} has a job-level if:`);
  const count = steps(job).find((s) => /test-count\.mjs --compare/.test(s));
  assert.match(count, /if: github\.event_name == 'pull_request'/);
  const onPush = steps(job).filter((s) => /if: github\.event_name == 'push'/.test(s));
  assert.equal(onPush.length, 1, "one step says why a push has nothing to count");
  assert.doesNotMatch(onPush[0], /exit [1-9]/);
  // Every step but that one is for pull requests only, so a push installs and runs nothing.
  for (const s of steps(job).filter((x) => x !== onPush[0] && !/uses: actions\/checkout/.test(x)))
    assert.match(s, /if: github\.event_name == 'pull_request'/, name(s));
});

test("the GitHub token is in one step, Who labelled held, before anything in its job installs packages", () => {
  const ci = jobs(read("ci.yml"));
  const holders = [...ci].flatMap(([id, job]) => steps(job).map((s) => [id, s])).filter(([, s]) => /GH_TOKEN/.test(s));
  assert.deepEqual(
    holders.map(([, s]) => name(s)),
    ["Who labelled held"],
  );
  const [id] = holders[0];
  const order = steps(ci.get(id));
  const held = order.findIndex((s) => /GH_TOKEN/.test(s));
  const firstInstall = order.findIndex((s) => /pnpm (--dir \S+ )?install/.test(s));
  assert.ok(firstInstall > held, `${id}: step ${firstInstall} installs before the token step ${held}`);
  assert.match(order[0], /persist-credentials: false/, `${id} leaves the token in .git/config`);
});

test("the test count has what it reads: the base commit in its checkout, and the label history in its own job", () => {
  const [id, job] = [...jobs(read("ci.yml"))].find(([, text]) => /test-count\.mjs --compare/.test(text));
  // `git worktree add "$BASE_SHA"` needs the whole history, not the one-commit default.
  assert.match(steps(job)[0], /fetch-depth: 0/, `${id}: the base commit is not checked out`);
  // Jobs don't share $RUNNER_TEMP, so the events file is written in the job that reads it.
  const events = /--held-events "(\$RUNNER_TEMP\/[^"]+)"/.exec(job)?.[1];
  assert.ok(events, `${id}: the compare step reads no label history`);
  assert.ok(job.includes(`> "${events}"`), `${id}: nothing in the job writes ${events}`);
});

test("the database job applies every migration and fails when the stack gave no keys", () => {
  const db = jobs(read("ci.yml")).get("db");
  assert.match(db, /pnpm test:migrations/);
  assert.match(db, /pnpm test:stack/);
  assert.match(db, /stack tests would not run"\n\s+exit 1/);
});

test("the dependency job runs the report against the base", () => {
  assert.match(jobs(read("ci.yml")).get("deps"), /node tools\/gates\/deps-report\.mjs --base "\$RUNNER_TEMP\/base"/);
});

test("a green nightly run closes the open failure issue", () => {
  const nightly = read("nightly.yml");
  assert.match(nightly, /- name: Close the failure issue after a green run\n\s+if: success\(\)/);
  assert.match(nightly, /gh issue close "\$number"/);
});

test("the nightly run comments on and closes only the failure issue it opened: anyone can open one of that title", () => {
  const lists = read("nightly.yml").match(/gh issue list.*(?:\\\r?\n.*)*/g) ?? [];
  assert.equal(lists.length, 2, "one list to comment on the issue, one to close it");
  for (const list of lists) assert.match(list, /--author app\/github-actions\b/);
});

test("an e2e failure in CI is retried once with a trace, still fails when only the retry passed, and uploads the report", () => {
  const config = readFileSync(path.join(ROOT, "packages", "app", "playwright.config.ts"), "utf8");
  assert.match(config, /\n {2}retries: process\.env\.CI \? 1 : 0,\n/);
  // Without it a test that fails then passes is "flaky" and the run passes: the retry would hide the failure.
  assert.match(config, /\n {2}failOnFlakyTests: !!process\.env\.CI,\n/);
  assert.match(config, /trace: "on-first-retry"/);
  assert.match(config, /\["html", \{ open: "never" \}\]/);
  const all = steps(jobs(read("ci.yml")).get("e2e"));
  const run = all.findIndex((s) => /test:e2e/.test(s));
  const upload = all.findIndex((s) => /uses: actions\/upload-artifact@/.test(s));
  assert.ok(run >= 0 && upload > run, "the report upload comes after the tests");
  assert.match(all[upload], /if: failure\(\)\n/);
  assert.match(all[upload], /path: packages\/app\/playwright-report\/\n/);
  assert.doesNotMatch(all[run], /continue-on-error/);
});
