// Tests for status.mjs, the sprint log's status block, beyond what rules.test.mjs replays from October.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { status } from "./status.mjs";
import { readSprintDoc } from "./sprint-doc.mjs";

const DOC = readSprintDoc(readFileSync(path.join(import.meta.dirname, "fixtures", "october-sprint.md"), "utf8"));
const issue = (number, labels, extra = {}) => ({
  number,
  title: `[task] R${number}: x`,
  state: "OPEN",
  labels,
  deps: null,
  comments: [],
  ...extra,
});
const pr = (number) => ({
  number,
  title: `R${number}`,
  state: "OPEN",
  isDraft: false,
  head: `task/${number - 100}`,
  base: "main",
  labels: ["lane:rules"],
  mergeable: "MERGEABLE",
  autoMerge: false,
  closes: [number - 100],
  reviewRequired: false,
  reviewers: [],
  comments: [],
  checks: [{ name: "gate", state: "SUCCESS" }],
});
const snap = (issues, prs) => ({
  now: new Date("2026-10-21T12:00:00Z"),
  freeMb: 16000,
  localMinutes: 0,
  owner: "astevegreen",
  mainChangedAt: "2026-10-21T11:00:00Z",
  sonar: {},
  issues,
  prs,
});

// After-sprint fix 14: a lane issue with neither sprint-ready nor blocked is one no lane will build, and the owner
// answering its question doesn't change that, so the status block names it instead of leaving it unseen.
test("a lane issue with neither sprint-ready nor blocked, and nothing building it, joins Needs you", () => {
  const S = snap(
    [
      issue(7, ["lane:app"]),
      issue(8, ["lane:app", "sprint-ready"]),
      issue(9, ["lane:app", "spec-review"]),
      issue(10, ["lane:app", "in-progress"]),
      issue(30, ["lane:rules"]),
      issue(11, ["lane:elsewhere"]),
      issue(12, ["lane:app"], { state: "CLOSED" }),
      issue(13, ["ready"]),
    ],
    [pr(130)],
  );
  assert.deepEqual(status(S, DOC).needsYou, [
    "#7 [task] R7: x: in lane app with neither sprint-ready nor blocked, so no lane builds it",
  ]);
});
