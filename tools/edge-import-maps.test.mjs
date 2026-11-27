// Every Edge Function folder needs a deno.json import map, or Deno cannot resolve @supabase/supabase-js and the
// @terminal-dusk packages when the function is served or deployed. All functions share one map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FUNCTIONS = fileURLToPath(new URL("../packages/server/supabase/functions/", import.meta.url));
const folders = readdirSync(FUNCTIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const importMap = (folder) => JSON.parse(readFileSync(join(FUNCTIONS, folder, "deno.json"), "utf8"));

test("finds the Edge Functions, redeem among them", () => {
  assert.ok(folders.includes("redeem"));
  assert.ok(folders.includes("invite"));
});

for (const folder of folders) {
  test(`${folder} has a deno.json import map, the same as every other function's`, () => {
    assert.deepEqual(importMap(folder), importMap("invite"));
  });
}
