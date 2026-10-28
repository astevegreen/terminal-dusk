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
