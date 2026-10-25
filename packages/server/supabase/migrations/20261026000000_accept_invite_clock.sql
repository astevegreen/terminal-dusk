-- accept_invite as before (20261022000000_match_invite.sql), now also writing the match's deadline clock and next
-- deadline (the columns 20261023000000_match_clock.sql added; packages/server/src/matchRow.ts works out both), so a
-- match made from an invite can be found by the deadline sweep (docs/architecture.md, Decision 5, "Deadlines").
-- A match without a clock gets null in both, as before.
create or replace function public.accept_invite(
  p_code text,
  p_joiner uuid,
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
  perform 1 from public.match_invite
  where code = p_code and joiner_id is null
  for update;

  if not found then
    return 'unavailable';
  end if;

  m := jsonb_populate_record(null::public.match, p_match);

  insert into public.match (
    match_id, lio_player, sae_player, ruleset, seed_hash, seed, seq, status, created_at, updated_at, clock,
    next_deadline
  )
  values (
    m.match_id, m.lio_player, m.sae_player, m.ruleset, m.seed_hash, m.seed, m.seq, m.status, m.created_at,
    m.updated_at, m.clock, m.next_deadline
  );

  insert into public.match_secret (match_id, secret)
  values (m.match_id, p_secret);

  insert into public.match_view (match_id, viewer, seq, frame)
  select m.match_id, v.viewer, v.seq, v.frame
  from jsonb_populate_recordset(null::public.match_view, p_views) as v;

  insert into public.match_event (match_id, seq, viewer, events)
  select m.match_id, e.seq, e.viewer, e.events
  from jsonb_populate_recordset(null::public.match_event, p_events) as e;

  update public.match_invite
  set joiner_id = p_joiner, match_id = m.match_id
  where code = p_code and joiner_id is null;

  return 'accepted';
end;
$$;

-- Replacing a function keeps its privileges; they are stated again so this file shows them.
revoke execute on function public.accept_invite(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.accept_invite(text, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
