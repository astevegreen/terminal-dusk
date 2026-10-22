-- A match's deadline clock (docs/architecture.md, Decision 5, "Deadlines" and "Scheduled jobs").
-- `clock` holds the match record's clock as it is, or null for a match without one. `next_deadline` is the
-- earliest deadline (whole milliseconds since 1970) while the game is active, else null: the deadline sweep
-- reads it to find the matches that are due. packages/server/src/matchRow.ts works out both columns.
-- Read rules stay as they are: anyone who may read a match row may read these columns, and the client roles
-- keep no insert, update, delete or truncate privilege on public.match (hard rule 7).

alter table public.match
  add column clock jsonb,
  add column next_deadline bigint;

-- The sweep asks for the matches whose next deadline has passed, earliest first.
create index match_next_deadline_idx on public.match (next_deadline, match_id)
  where next_deadline is not null;

-- commit_match as before (20261021000000_commit_match.sql), now also writing the two new columns.
create or replace function public.commit_match(
  p_match_id text,
  p_expected_seq integer,
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
begin
  m := jsonb_populate_record(null::public.match, p_match);

  update public.match set
    lio_player = m.lio_player,
    sae_player = m.sae_player,
    ruleset = m.ruleset,
    seed_hash = m.seed_hash,
    seed = m.seed,
    seq = m.seq,
    status = m.status,
    created_at = m.created_at,
    updated_at = m.updated_at,
    clock = m.clock,
    next_deadline = m.next_deadline
  where match_id = p_match_id and seq = p_expected_seq;

  if not found then
    return 'conflict';
  end if;

  insert into public.match_secret (match_id, secret)
  values (p_match_id, p_secret)
  on conflict (match_id) do update set secret = excluded.secret;

  delete from public.match_view where match_id = p_match_id;
  insert into public.match_view (match_id, viewer, seq, frame)
  select p_match_id, v.viewer, v.seq, v.frame
  from jsonb_populate_recordset(null::public.match_view, p_views) as v;

  insert into public.match_event (match_id, seq, viewer, events)
  select p_match_id, e.seq, e.viewer, e.events
  from jsonb_populate_recordset(null::public.match_event, p_events) as e;

  return 'saved';
end;
$$;

-- Replacing a function keeps its privileges; they are stated again so this file shows them.
revoke execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
