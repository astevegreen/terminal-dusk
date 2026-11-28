-- Rating changes (docs/architecture.md, Decision 5: `rating_change`, read by everyone; Finalize; #734).
-- One row per player per ranked match: their rating before and after that game and how many ranked games they had
-- once it was counted. The result screen reads it, so it shows the true change even when the game ended before the
-- screen opened. It holds ratings and counts only, so nothing hidden. Anyone may read it; only the server writes it,
-- inside commit_match, in the same transaction as the rating rows (hard rule 7). Times are whole milliseconds.

create table public.rating_change (
  -- No foreign keys, like the rating table's player column.
  match_id text not null,
  player uuid not null,
  rating_before double precision not null check (rating_before >= 0 and rating_before <= 5000),
  rating_after double precision not null check (rating_after >= 0 and rating_after <= 5000),
  -- The player's ranked-game count after this game.
  ranked_games integer not null check (ranked_games >= 1),
  created_at bigint not null,
  primary key (match_id, player)
);

alter table public.rating_change enable row level security;
revoke all on public.rating_change from anon, authenticated;
grant select on public.rating_change to anon, authenticated;

create policy "anyone reads rating changes" on public.rating_change
  for select to anon, authenticated
  using (true);

-- commit_match as in 20261102000000_rating.sql, with one more write: each `p_ratings` entry also carries `change`,
-- a rating_change row, inserted right after its rating row inside the same exception block, so a 'ratingsMoved'
-- undo takes the change rows back too. Replaced in place: the argument list is unchanged.
create or replace function public.commit_match(
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
      if w -> 'change' is not null and jsonb_typeof(w -> 'change') = 'object' then
        insert into public.rating_change
        select * from jsonb_populate_record(null::public.rating_change, w -> 'change');
      end if;
    end loop;
  exception
    when sqlstate 'TD001' then
      return 'ratingsMoved';
  end;

  return 'saved';
end;
$$;

-- create or replace keeps the grants of 20261102000000_rating.sql; they are stated again so this file stands alone.
revoke execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_match(text, integer, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
