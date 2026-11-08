// The local Supabase stack (packages/server/supabase/config.toml) runs on the owner's computer, so it must not
// carry services that only burn CPU there. Analytics brings two containers, the log store and the log collector
// (vector); on Windows the collector cannot reach Docker's daemon, exits and is restarted about once a minute,
// all day (1,636 restarts on 8 Nov). No test or lane reads the stack's logs, so analytics stays off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../packages/server/supabase/config.toml", import.meta.url), "utf8");

/** The `key = value` lines under one [section], as raw strings. */
function section(toml, name) {
  const out = {};
  let current = "";
  for (const line of toml.split(/\r?\n/)) {
    const head = /^\[([^\]]+)\]/.exec(line);
    if (head) current = head[1];
    const pair = /^(\w+)\s*=\s*(.+?)\s*$/.exec(line);
    if (pair && current === name) out[pair[1]] = pair[2];
  }
  return out;
}

test("analytics (the log store and its crash-looping collector) is off in the local stack", () => {
  assert.equal(section(config, "analytics").enabled, "false");
});
