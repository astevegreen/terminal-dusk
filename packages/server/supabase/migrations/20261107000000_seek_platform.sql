-- A ranked ticket records the platform it was searched on (#687). The matchmake sweep checks the Full Game again at
-- pairing, and an entitlement counts only for the exact platform played on, so the ticket must say which one that is.
-- Tickets stored before this column existed were all searched on 'web' (the default is dropped right after, so a new
-- ticket must always say its platform). create_seek takes the platform; the old function is replaced.

alter table public.seek add column platform text not null default 'web'
  check (platform in ('web', 'steam', 'ios', 'android'));
alter table public.seek alter column platform drop default;

drop function public.create_seek(uuid, uuid, integer, text, text, bigint, integer);

create function public.create_seek(
  p_id uuid,
  p_player uuid,
  p_rating integer,
  p_preset text,
  p_side text,
  p_created_at bigint,
  p_limit integer,
  p_platform text
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

  insert into public.seek (id, player, rating, preset, side, created_at, platform)
  values (p_id, p_player, p_rating, p_preset, p_side, p_created_at, p_platform);
  return 'saved';
end;
$$;

revoke execute on function public.create_seek(uuid, uuid, integer, text, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function public.create_seek(uuid, uuid, integer, text, text, bigint, integer, text) to service_role;
