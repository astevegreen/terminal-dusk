// The scheduled-job migration (supabase/migrations/20261026000000_sweep_jobs.sql). The text checks always run;
// the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an empty
// database first. They prove the two jobs exist once each, call_sweep posts nothing while Vault has no secrets,
// refuses other names, and that clients may run neither function.
// Without a running local stack, one test says so and how to start it.
import { describe, expect, it } from "vitest";
import SWEEP_MIGRATION from "../../supabase/migrations/20261026000000_sweep_jobs.sql?raw";
import { onLocalStack } from "../test/stack.ts";
import { client } from "./localStack.ts";

const PERMISSION_DENIED = "42501";
const EVERY_MINUTE = "* * * * *";
const SWEEPS = ["sweep-deadlines", "sweep-turn-alerts"] as const;
const commandFor = (name: string) => `select public.call_sweep('${name}')`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("the scheduled-job migration's text", () => {
  it("enables pg_cron and pg_net if they are not already enabled", () => {
    expect(SWEEP_MIGRATION).toMatch(/create extension if not exists pg_cron\b/);
    expect(SWEEP_MIGRATION).toMatch(/create extension if not exists pg_net\b/);
  });

  it.each(SWEEPS)("schedules the %s job by name every minute, with only a call_sweep command", (name) => {
    const schedule = `select cron.schedule('${name}', '${EVERY_MINUTE}', $$${commandFor(name)}$$);`;
    expect(SWEEP_MIGRATION).toContain(schedule);
    expect(SWEEP_MIGRATION.match(new RegExp(`cron\\.schedule\\('${escape(name)}'`, "g"))).toHaveLength(1);
  });

  it("call_sweep is a security definer with an empty search path, and accepts only the two sweeps", () => {
    expect(SWEEP_MIGRATION).toMatch(
      /create or replace function public\.call_sweep\(p_function text\)\s+returns text\s+language plpgsql\s+security definer\s+set search_path = ''/,
    );
    expect(SWEEP_MIGRATION).toContain("p_function not in ('sweep-deadlines', 'sweep-turn-alerts')");
  });

  it("call_sweep reads the project_url and service_role_key Vault secrets and posts with a Bearer key", () => {
    expect(SWEEP_MIGRATION).toMatch(/from vault\.decrypted_secrets s where s\.name = 'project_url'/);
    expect(SWEEP_MIGRATION).toMatch(/from vault\.decrypted_secrets s where s\.name = 'service_role_key'/);
    expect(SWEEP_MIGRATION).toContain("return 'unconfigured';");
    expect(SWEEP_MIGRATION).toContain("rtrim(v_url, '/') || '/functions/v1/' || p_function");
    expect(SWEEP_MIGRATION).toContain("'Authorization', 'Bearer ' || v_key");
    expect(SWEEP_MIGRATION).toContain("perform net.http_post(");
  });

  it("sweep_jobs is a security definer reading the cron jobs whose name starts with sweep-", () => {
    expect(SWEEP_MIGRATION).toMatch(/create or replace function public\.sweep_jobs\(\)[\s\S]*?security definer/);
    expect(SWEEP_MIGRATION).toMatch(/from cron\.job j\s+where j\.jobname like 'sweep-%'/);
  });

  it("only the service role may run call_sweep and sweep_jobs, and clients lose every privilege on net", () => {
    for (const fn of ["public.call_sweep(text)", "public.sweep_jobs()"]) {
      expect(SWEEP_MIGRATION).toContain(`revoke execute on function ${fn} from public, anon, authenticated;`);
      expect(SWEEP_MIGRATION).toContain(`grant execute on function ${fn} to service_role;`);
    }
    expect(SWEEP_MIGRATION).toContain("revoke all on schema net from public, anon, authenticated;");
    expect(SWEEP_MIGRATION).toContain("revoke all on all functions in schema net from public, anon, authenticated;");
    expect(SWEEP_MIGRATION).toContain("revoke all on all tables in schema net from public, anon, authenticated;");
    const grants = SWEEP_MIGRATION.match(/^\s*grant\b.*$/gim) ?? [];
    expect(grants.every((line) => /to service_role;\s*$/.test(line))).toBe(true);
    expect(SWEEP_MIGRATION).not.toMatch(/create policy/i);
  });

  it("writes no literal url or key", () => {
    expect(SWEEP_MIGRATION).not.toMatch(/https?:\/\//i);
    expect(SWEEP_MIGRATION).not.toMatch(/\.supabase\.co/i);
    expect(SWEEP_MIGRATION).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(SWEEP_MIGRATION).not.toMatch(/sb_(secret|publishable)_/);
  });
});

await onLocalStack("scheduled-job migration on the local Supabase stack", (keys) => {
  const service = client(keys.url, keys.serviceKey);
  const anon = client(keys.url, keys.anonKey);

  it("sweep_jobs finds exactly one job of each sweep, every minute, calling call_sweep", async () => {
    const { data, error } = await service.rpc("sweep_jobs");
    expect(error).toBeNull();
    expect(data).toEqual(SWEEPS.map((name) => ({ jobname: name, schedule: EVERY_MINUTE, command: commandFor(name) })));
  }, 60_000);

  it("call_sweep returns 'unconfigured' without an error while no Vault secrets exist", async () => {
    const { data, error } = await service.rpc("call_sweep", { p_function: "sweep-deadlines" });
    expect(error).toBeNull();
    expect(data).toBe("unconfigured");
  }, 60_000);

  it("call_sweep refuses a name that is not a sweep", async () => {
    const { data, error } = await service.rpc("call_sweep", { p_function: "other" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  }, 60_000);

  it.each([
    ["call_sweep", { p_function: "sweep-deadlines" }],
    ["sweep_jobs", {}],
  ] as const)(
    "a signed-out client may not run %s",
    async (fn, args) => {
      const { data, error } = await anon.rpc(fn, args);
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
    },
    60_000,
  );
});
