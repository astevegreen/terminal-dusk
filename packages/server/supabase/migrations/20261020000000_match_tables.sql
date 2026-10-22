-- The match tables and who may read them (docs/architecture.md, Decision 5).
-- Only the server's submit function writes these tables (hard rule 7). It uses the service role, which
-- bypasses row-level security, so no client role gets an insert, update or delete policy or privilege.
-- Times are whole-number milliseconds since 1970, so they are bigint: a 32-bit integer overflows in 1970.

create table public.match (
  match_id text primary key,
  lio_player uuid not null,
  sae_player uuid not null,
  ruleset text not null,
  seed_hash text not null,
  seed text,
  seq integer not null,
  status jsonb not null,
  created_at bigint not null,
  updated_at bigint not null
);

-- Full game state, seed and move log. Server only: no policy at all, and no client privilege.
create table public.match_secret (
  match_id text primary key references public.match (match_id) on delete cascade,
  secret jsonb not null
);

-- The latest frame for each viewer of a match.
create table public.match_view (
  match_id text not null references public.match (match_id) on delete cascade,
  viewer text not null check (viewer in ('lio', 'sae', 'spectator')),
  seq integer not null,
  frame jsonb not null,
  primary key (match_id, viewer)
);

-- The events each viewer may see, one row per step and viewer.
create table public.match_event (
  match_id text not null references public.match (match_id) on delete cascade,
  seq integer not null,
  viewer text not null check (viewer in ('lio', 'sae', 'spectator')),
  events jsonb not null,
  primary key (match_id, seq, viewer)
);

alter table public.match enable row level security;
alter table public.match_secret enable row level security;
alter table public.match_view enable row level security;
alter table public.match_event enable row level security;

-- Clients may only read. Truncate is revoked too, because it would skip row-level security.
revoke all on public.match_secret from anon, authenticated;
revoke insert, update, delete, truncate on public.match, public.match_view, public.match_event from anon, authenticated;
grant select on public.match, public.match_view, public.match_event to anon, authenticated;

-- Players and spectators, signed in or not, may read every match row.
create policy "anyone reads matches" on public.match
  for select to anon, authenticated
  using (true);

-- The spectator frame is public; the lio frame is only for the match's lio_player, the sae frame only for its sae_player.
create policy "viewer reads own frame" on public.match_view
  for select to anon, authenticated
  using (
    viewer = 'spectator'
    or exists (
      select 1 from public.match m
      where m.match_id = match_view.match_id
        and (
          (match_view.viewer = 'lio' and m.lio_player = (select auth.uid()))
          or (match_view.viewer = 'sae' and m.sae_player = (select auth.uid()))
        )
    )
  );

-- Events follow the same rule as frames.
create policy "viewer reads own events" on public.match_event
  for select to anon, authenticated
  using (
    viewer = 'spectator'
    or exists (
      select 1 from public.match m
      where m.match_id = match_event.match_id
        and (
          (match_event.viewer = 'lio' and m.lio_player = (select auth.uid()))
          or (match_event.viewer = 'sae' and m.sae_player = (select auth.uid()))
        )
    )
  );
