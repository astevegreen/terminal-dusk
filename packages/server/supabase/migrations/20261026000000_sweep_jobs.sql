-- The scheduled job (docs/architecture.md, Decision 5, "Scheduled jobs (every minute)"): every minute pg_cron
-- calls the sweep-deadlines and sweep-turn-alerts Edge Functions through pg_net. Both sweeps are safe to run
-- twice (.claude/rules/server.md), and scheduling by name replaces a job of the same name, so the jobs are never
-- doubled when the migrations are applied again.
--
-- On a hosted project the owner creates two Vault secrets once (in the dashboard's Vault page, or with
-- `select vault.create_secret('<value>', '<name>');`):
--   project_url       the project's address, as shown in the dashboard's API settings
--   service_role_key  the project's service role key, which each sweep checks (src/sweepEdge.ts)
-- Until both exist the job posts nothing: call_sweep returns 'unconfigured'. No address or key is written here.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Posts to one sweep function with the service role key, both read from Vault when it runs. Returns 'posted',
-- or 'unconfigured' (posting nothing) while either secret is missing, empty or only spaces.
create or replace function public.call_sweep(p_function text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if p_function is null or p_function not in ('sweep-deadlines', 'sweep-turn-alerts') then
    raise exception 'call_sweep: % is not a sweep function', coalesce(p_function, 'null')
      using errcode = '22023';
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'service_role_key';
  v_url := btrim(coalesce(v_url, ''));
  v_key := btrim(coalesce(v_key, ''));
  if v_url = '' or v_key = '' then
    return 'unconfigured';
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  );
  return 'posted';
end;
$$;

-- The sweep jobs as pg_cron stores them, for the migration test: the test client reaches the database only
-- through PostgREST, which cannot read the cron schema.
create or replace function public.sweep_jobs()
returns table (jobname text, schedule text, command text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.command::text
  from cron.job j
  where j.jobname like 'sweep-%'
  order by j.jobname;
$$;

-- Only the server's service role may run either function.
revoke execute on function public.call_sweep(text) from public, anon, authenticated;
grant execute on function public.call_sweep(text) to service_role;
revoke execute on function public.sweep_jobs() from public, anon, authenticated;
grant execute on function public.sweep_jobs() to service_role;

-- Clients get nothing from pg_net, in case enabling the extension granted them anything.
revoke all on schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;

-- Scheduling by name replaces any job of the same name.
select cron.schedule('sweep-deadlines', '* * * * *', $$select public.call_sweep('sweep-deadlines')$$);
select cron.schedule('sweep-turn-alerts', '* * * * *', $$select public.call_sweep('sweep-turn-alerts')$$);
