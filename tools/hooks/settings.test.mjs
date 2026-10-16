// Tests for the web rules in .claude/settings.json and the agents' own tool limits.
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

test("opening a web page still asks the owner first", () => {
  const { allow, ask } = permissions();
  assert.ok(ask.includes("WebFetch"), "WebFetch is missing from the ask list");
  assert.ok(!allow.includes("WebFetch"), "WebFetch is on the allow list");
});

for (const agent of ["implementer", "reviewer"]) {
  test(`the ${agent} agent can't use the web at all`, () => {
    const tools = disallowedTools(agent);
    assert.ok(tools.includes("WebSearch") && tools.includes("WebFetch"), `disallowedTools: ${tools.join(", ")}`);
  });
}
