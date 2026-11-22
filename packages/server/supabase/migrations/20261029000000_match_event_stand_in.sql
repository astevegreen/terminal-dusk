-- Which side the host played for in a step (#605, the "defaultAnswer" deadline rule): when a side misses its deadline
-- the host answers for it, and the step's three event rows (one per viewer) name that side here. Null for an
-- ordinary step. It holds a side's name only; nothing hidden. Clients read it under the same row-level policies as
-- the rest of the row.
--
-- commit_match names the match_event columns it writes, so it is replaced below to write `stand_in` too (the same
-- function as in 20261023000000_match_clock.sql, with only that column added). accept_invite is left as it is: the
-- first step of a game is never a stand-in, so its rows keep a null `stand_in`.
alter table public.match_event
  add column stand_in text check (stand_in in ('lio', 'sae'));

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

  insert into public.match_event (match_id, seq, viewer, events, stand_in)
  select p_match_id, e.seq, e.viewer, e.events, e.stand_in
  from jsonb_populate_recordset(null::public.match_event, p_events) as e;

  return 'saved';
end;
$$;

-- Replacing a function keeps its privileges; they are stated again so this file shows them.
revoke execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
