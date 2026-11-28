-- Ratings (docs/architecture.md, Decision 5: `profile`, `rating`, read by everyone; Finalize; #679).
-- `rating` holds one Glicko-2 rating per player for both sides, how many ranked games they finished, and their
-- wins, losses and draws as LIO and as SAE. A player has no row until their first ranked game finishes. It holds
-- no game data, so nothing hidden. Anyone may read it; only the server writes it, inside commit_match, in the same
-- transaction as the step that finishes a ranked game (hard rule 7). Times are whole milliseconds (bigint).
--
-- `match.ranked` marks a ranked match. It is set when the match is created (#681) and never changes, so
-- commit_match does not write it. Invites leave it false: a private game is never rated.

alter table public.match
  add column ranked boolean not null default false;

create table public.rating (
  -- No foreign key on user ids, like the match table's player columns.
  player uuid primary key,
  rating double precision not null check (rating >= 0 and rating <= 5000),
  deviation double precision not null check (deviation >= 30 and deviation <= 350),
  volatility double precision not null check (volatility > 0 and volatility <= 1),
  ranked_games integer not null check (ranked_games >= 1),
  lio_wins integer not null check (lio_wins >= 0),
  lio_losses integer not null check (lio_losses >= 0),
  lio_draws integer not null check (lio_draws >= 0),
  sae_wins integer not null check (sae_wins >= 0),
  sae_losses integer not null check (sae_losses >= 0),
  sae_draws integer not null check (sae_draws >= 0),
  updated_at bigint not null,
  check (ranked_games = lio_wins + lio_losses + lio_draws + sae_wins + sae_losses + sae_draws)
);

-- Everyone may read, signed in or not; no client role may write. Truncate is revoked too, because it would skip
-- row-level security.
alter table public.rating enable row level security;
revoke all on public.rating from anon, authenticated;
grant select on public.rating to anon, authenticated;

create policy "anyone reads ratings" on public.rating
  for select to anon, authenticated
  using (true);

-- commit_match as in 20261029000000_match_event_stand_in.sql, with one more argument: `p_ratings`, null for an
-- ordinary step, or for the step that finishes a ranked game both players' new rows, each with `expected`, the
-- ranked-game count their row had when the server read it (0: no row). After the seq-guarded match update, each row
-- is written only while its stored count is still `expected`: a first row is inserted only if none exists, a later
-- one updated only where `ranked_games = expected`. If either fails, another finish rated that player first, so
-- the whole step is undone (the exception block rolls back everything inside it) and it answers 'ratingsMoved';
-- the server reads the ratings again and retries. Rows come ordered by player id, so two finishes lock in one order.
-- The old six-argument function is dropped, so there is one commit_match; callers that pass no ratings still work.
drop function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb);

create function public.commit_match(
  p_match_id text,
  p_expected_seq integer,
  p_match jsonb,
  p_secret jsonb,
  p_views jsonb,
  p_events jsonb,
  p_ratings jsonb default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.match;
  w jsonb;
  r public.rating;
  expected integer;
begin
  m := jsonb_populate_record(null::public.match, p_match);

  begin
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

    for w in select value from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
      r := jsonb_populate_record(null::public.rating, w -> 'row');
      expected := (w ->> 'expected')::integer;
      if expected = 0 then
        insert into public.rating values (r.*) on conflict (player) do nothing;
      else
        update public.rating set
          rating = r.rating,
          deviation = r.deviation,
          volatility = r.volatility,
          ranked_games = r.ranked_games,
          lio_wins = r.lio_wins,
          lio_losses = r.lio_losses,
          lio_draws = r.lio_draws,
          sae_wins = r.sae_wins,
          sae_losses = r.sae_losses,
          sae_draws = r.sae_draws,
          updated_at = r.updated_at
        where player = r.player and ranked_games = expected;
      end if;
      if not found then
        raise exception using errcode = 'TD001', message = 'ratings moved';
      end if;
    end loop;
  exception
    when sqlstate 'TD001' then
      return 'ratingsMoved';
  end;

  return 'saved';
end;
$$;

-- Only the server's service role may run it. Supabase grants execute on new functions to the client roles by
-- default, so it is taken away from them (and from public) by name.
revoke execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
