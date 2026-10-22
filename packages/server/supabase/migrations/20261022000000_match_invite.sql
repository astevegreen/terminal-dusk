-- Private game invites (docs/architecture.md, Decision 5). A host's invite waits here until a second player joins
-- with its code; joining marks it used and creates the match in one transaction (accept_invite below).
-- Only the server reads or writes invites, with the service role: clients get no policy and no privilege.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables.

create table public.match_invite (
  code text primary key,
  -- No foreign key on user ids, like the match table's player columns.
  host_id uuid not null,
  -- How the sides are assigned: drawn at random, chosen by the host, or chosen by the invitee when joining.
  mode text not null check (mode in ('random', 'host', 'invitee')),
  -- The host's side: set only when the host chose it.
  host_side text,
  created_at bigint not null,
  -- Who joined and the match it made: both null until someone joins, then both set.
  joiner_id uuid,
  -- Deleting a match (a finished one, or a test's) removes its invite too.
  match_id text references public.match (match_id) on delete cascade,
  -- "is not null" is spelled out because a check that comes out null (unknown) counts as passed.
  constraint match_invite_host_side check (
    (mode = 'host' and host_side is not null and host_side in ('lio', 'sae'))
    or (mode in ('random', 'invitee') and host_side is null)
  ),
  constraint match_invite_joined check ((joiner_id is null) = (match_id is null)),
  constraint match_invite_joiner_not_host check (joiner_id is null or joiner_id <> host_id)
);

-- Row-level security with no policy at all, and no client privilege (truncate would skip row-level security).
alter table public.match_invite enable row level security;
revoke all on public.match_invite from anon, authenticated;

-- Joins an invite in one transaction. It locks the invite row while it is unused; when the code is unknown or
-- already used it writes nothing and answers 'unavailable'. Otherwise it inserts the new match's match,
-- match_secret, match_view and match_event rows (the ones packages/server/src/rows.ts builds), marks the invite
-- used by p_joiner with that match, and answers 'accepted'. Any error rolls back everything it wrote.
-- Two joins at once: the second waits for the first's lock, then finds the invite used and answers 'unavailable'.
create function public.accept_invite(
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
    match_id, lio_player, sae_player, ruleset, seed_hash, seed, seq, status, created_at, updated_at
  )
  values (
    m.match_id, m.lio_player, m.sae_player, m.ruleset, m.seed_hash, m.seed, m.seq, m.status, m.created_at,
    m.updated_at
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

-- Only the server's service role may run it. Supabase grants execute on new functions to the client roles by
-- default, so it is taken away from them (and from public) by name.
revoke execute on function public.accept_invite(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.accept_invite(text, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
