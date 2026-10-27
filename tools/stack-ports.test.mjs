// The local Supabase stack's ports (packages/server/supabase/config.toml) must stay out of the TCP range Windows
// reserves for itself (54280-54379 on this machine, inside the dynamic range 49152-65535), or `supabase start` fails.
// Every file that names a stack port must agree with config.toml.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const config = read("packages/server/supabase/config.toml");

/** `port` lines under each [section], e.g. { api: { port: 44321 }, db: { port: 44322, shadow_port: 44320 } }. */
function ports(toml) {
  const out = {};
  let section = "";
  for (const line of toml.split(/\r?\n/)) {
    const head = /^\[([^\]]+)\]/.exec(line);
    if (head) section = head[1];
    const port = /^(\w*port)\s*=\s*(\d+)/.exec(line);
    if (port) (out[section] ??= {})[port[1]] = Number(port[2]);
  }
  return out;
}
const p = ports(config);
const all = Object.values(p).flatMap((s) => Object.values(s));

test("every stack service has its port set in config.toml", () => {
  for (const s of ["api", "db", "db.pooler", "studio", "inbucket", "analytics"]) assert.ok(p[s]?.port, s);
  assert.ok(p.db.shadow_port);
});

test("no stack port is in Windows' dynamic range, so none can be reserved", () => {
  for (const n of all) assert.ok(n < 49152, `${n} is in 49152-65535`);
  assert.equal(new Set(all).size, all.length, "two services share a port");
});

test("the sign-in email hook calls the API port", () => {
  assert.match(config, new RegExp(`host\.docker\.internal:${p.api.port}/functions/v1/auth-email`));
});

test("every mail catcher address in the code uses the inbucket port", () => {
  const files = [
    "packages/app/e2e-stack/mail.ts",
    "packages/app/e2e-stack/helpers.test.ts",
    "packages/app/e2e-stack/phase4.e2e.ts",
    "packages/server/src/authEmailMailpit.stack.test.ts",
    "packages/server/src/localMailer.test.ts",
    "packages/server/src/migrations/localStack.ts",
  ];
  for (const f of files) {
    const named = [...read(f).matchAll(/(?:127\.0\.0\.1|host\.docker\.internal|\}):(\d{4,5})/g)].map((m) =>
      Number(m[1]),
    );
    assert.ok(named.length > 0, `${f} names no port`);
    for (const n of named) assert.equal(n, p.inbucket.port, f);
  }
});
