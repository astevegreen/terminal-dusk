-- Public ranked matchmaking (docs/architecture.md, Decision 5, `seek` and "Scheduled jobs", Matchmaking; #681).
-- A ticket is one player's search for a ranked game. It waits here until the one-minute `matchmake` job pairs it
-- (packages/server/src/matchmake.ts), so a player may close the app. A ticket holds a rating, a deadline preset NAME
-- and a side preference: nothing hidden. Only the server writes tickets, with the service role, through create_seek
-- (which has already checked the entitlement in TypeScript, and checks the limit of 5 here) and pair_seeks.
-- A player reads only their own tickets. Times are whole-number milliseconds since 1970 (bigint).

create table public.seek (
  id uuid primary key,
  -- No foreign key on user ids, like the match table's player columns.
  player uuid not null,
  -- The player's rating when they searched, rounded to a whole number (1500 while unrated).
  rating integer not null check (rating >= 0),
  -- The deadline preset NAME. The hours behind each name are a placeholder in packages/server/src/rankedPresets.ts.
  preset text not null check (preset in ('fast', 'normal', 'slow')),
  -- The side wanted: null for no preference.
  side text check (side is null or side in ('lio', 'sae')),
  created_at bigint not null check (created_at >= 0)
);

create index seek_player on public.seek (player);

alter table public.seek enable row level security;
-- No client write privilege (truncate would skip row-level security); a player may read only their own tickets.
revoke all on public.seek from anon, authenticated;
grant select on public.seek to authenticated;
create policy "players read their own tickets" on public.seek for select to authenticated using (player = auth.uid());

-- Stores a ticket unless the player already has p_limit unfinished ranked matches plus open tickets. The advisory
-- lock is per player, so two searches at once cannot both slip under the limit. Answers 'saved' or 'limit'.
create function public.create_seek(
  p_id uuid,
  p_player uuid,
  p_rating integer,
  p_preset text,
  p_side text,
  p_created_at bigint,
  p_limit integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_player::text));

  select
    (select count(*) from public.seek s where s.player = p_player)
    + (
      select count(*) from public.match m
      where m.ranked
        and m.status ->> 'kind' <> 'over'
        and p_player in (m.lio_player, m.sae_player)
    )
  into v_count;

  if v_count >= p_limit then
    return 'limit';
  end if;

  insert into public.seek (id, player, rating, preset, side, created_at)
  values (p_id, p_player, p_rating, p_preset, p_side, p_created_at);
  return 'saved';
end;
$$;

-- Pairs two tickets in one transaction. It locks both rows (in id order, so two pairings cannot wait on each other);
-- when either is gone it writes nothing and answers 'unavailable'. Otherwise it deletes both tickets, inserts the new
-- ranked match's match, match_secret, match_view and match_event rows (the ones packages/server/src/rows.ts builds)
-- and answers 'paired'. Run twice, the second finds no tickets. Any error rolls back everything it wrote.
create function public.pair_seeks(
  p_first uuid,
  p_second uuid,
  p_match jsonb,
  p_secret jsonb,
  p_views jsonb,
  p_events jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.match;
  v_locked integer;
begin
  select count(*) into v_locked
  from (
    select s.id from public.seek s where s.id in (p_first, p_second) order by s.id for update
  ) locked;

  if p_first = p_second or v_locked <> 2 then
    return 'unavailable';
  end if;

  m := jsonb_populate_record(null::public.match, p_match);

  insert into public.match (
    match_id, lio_player, sae_player, ruleset, seed_hash, seed, seq, status, created_at, updated_at, clock,
    next_deadline, ranked
  )
  values (
    m.match_id, m.lio_player, m.sae_player, m.ruleset, m.seed_hash, m.seed, m.seq, m.status, m.created_at,
    m.updated_at, m.clock, m.next_deadline, m.ranked
  );

  insert into public.match_secret (match_id, secret)
  values (m.match_id, p_secret);

  insert into public.match_view (match_id, viewer, seq, frame)
  select m.match_id, v.viewer, v.seq, v.frame
  from jsonb_populate_recordset(null::public.match_view, p_views) as v;

  insert into public.match_event (match_id, seq, viewer, events)
  select m.match_id, e.seq, e.viewer, e.events
  from jsonb_populate_recordset(null::public.match_event, p_events) as e;

  delete from public.seek where id in (p_first, p_second);

  return 'paired';
end;
$$;

-- Only the server's service role may run them (Supabase grants new functions to the client roles by default).
revoke execute on function public.create_seek(uuid, uuid, integer, text, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.create_seek(uuid, uuid, integer, text, text, bigint, integer) to service_role;
revoke execute on function public.pair_seeks(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pair_seeks(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;

-- call_sweep as before (20261026000000_sweep_jobs.sql), now also allowing the matchmake function.
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
  if p_function is null or p_function not in ('sweep-deadlines', 'sweep-turn-alerts', 'matchmake') then
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

revoke execute on function public.call_sweep(text) from public, anon, authenticated;
grant execute on function public.call_sweep(text) to service_role;

-- The matchmake job as pg_cron stores it, for the migration test (the job is named without the sweep- prefix, so
-- sweep_jobs() keeps listing only the two sweeps).
create function public.matchmake_job()
returns table (jobname text, schedule text, command text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.command::text
  from cron.job j
  where j.jobname = 'matchmake';
$$;

revoke execute on function public.matchmake_job() from public, anon, authenticated;
grant execute on function public.matchmake_job() to service_role;

-- Scheduling by name replaces any job of the same name.
select cron.schedule('matchmake', '* * * * *', $$select public.call_sweep('matchmake')$$);
