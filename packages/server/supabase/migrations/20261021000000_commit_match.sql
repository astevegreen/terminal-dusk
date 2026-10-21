-- The one write of a submit (docs/architecture.md, Decision 5): one transaction, guarded by `where seq = expectedSeq`.
-- It updates the match row only when the stored seq is still the expected one. When no row matched, it writes
-- nothing and answers 'conflict'. Otherwise it saves the secret, replaces the match's three view rows, adds its
-- three event rows and answers 'saved'. Any error (a malformed row, say) rolls back everything it wrote.
-- The rows are the ones packages/server/src/rows.ts builds; the match id always comes from the first argument.

create function public.commit_match(
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
    updated_at = m.updated_at
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

-- Only the server's service role may run it. Supabase grants execute on new functions to the client roles by
-- default, so it is taken away from them (and from public) by name.
revoke execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb) to service_role;
