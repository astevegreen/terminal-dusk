-- Checkout limit (issue #729). Each call to the checkout Edge Function makes a new Paddle transaction, so one
-- account calling in a loop could pile up drafts and use up Paddle's request allowance for every buyer. This keeps
-- one row per counted call for an hour; claim_checkout counts and records in one locked step.
-- The limit (10) and window (3600000 ms) match CHECKOUT_LIMIT and CHECKOUT_WINDOW_MS in
-- packages/server/src/checkoutLimitStore.ts. Times are whole-number milliseconds since 1970 (bigint).

create table public.checkout_attempt (
  player uuid not null,
  attempted_at bigint not null
);

create index checkout_attempt_player on public.checkout_attempt (player, attempted_at);

-- No client role may do anything with the table; truncate is revoked too because it would skip row-level security.
alter table public.checkout_attempt enable row level security;
revoke all on public.checkout_attempt from anon, authenticated;

-- 'limited'  ten or more calls by this player in the last hour; nothing is recorded.
-- 'allowed'  the call is recorded.
-- The player's advisory lock runs one player's claims one at a time, so the limit holds under racing calls.
create or replace function public.claim_checkout(p_player uuid, p_now bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  calls integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('claim_checkout ' || p_player::text));

  delete from public.checkout_attempt
  where player = p_player and attempted_at <= p_now - 3600000;

  select count(*) into calls from public.checkout_attempt where player = p_player;
  if calls >= 10 then
    return 'limited';
  end if;

  insert into public.checkout_attempt (player, attempted_at) values (p_player, p_now);
  return 'allowed';
end;
$$;

revoke execute on function public.claim_checkout(uuid, bigint) from public, anon, authenticated;
grant execute on function public.claim_checkout(uuid, bigint) to service_role;
