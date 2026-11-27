-- Gift codes (docs/architecture.md, Decision 7, "Free copies"; Decision 5, entitlements from verified sources).
-- tools/gift-codes.mjs stores each code's SHA-256 hash (packages/server/src/giftCode.ts), never the code, so a
-- leaked table leaks no usable code. The redeem Edge Function calls redeem_gift_code with the service role: no
-- client role may read or write either table or run the function.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables.

create table public.gift_code (
  -- The lowercase hex SHA-256 of the code without dashes.
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  -- The one platform the code is for: the platforms in packages/host/src/entitlement.ts (PLATFORMS).
  platform text not null check (platform in ('web', 'steam', 'ios', 'android')),
  created_at bigint not null,
  -- Who redeemed it and when; both null until then. No foreign key on user ids, like the entitlement table.
  redeemed_by uuid,
  redeemed_at bigint,
  check ((redeemed_by is null) = (redeemed_at is null))
);

-- A wrong guess (an unknown code, or one someone else redeemed), kept for an hour to rate limit its caller.
create table public.gift_code_attempt (
  player uuid not null,
  attempted_at bigint not null
);

create index gift_code_attempt_player on public.gift_code_attempt (player, attempted_at);

-- No client role may do anything with either table. Truncate is revoked too, because it would skip row-level
-- security; row-level security is on with no policies, so even a grant left behind by mistake reads nothing.
alter table public.gift_code enable row level security;
alter table public.gift_code_attempt enable row level security;
revoke all on public.gift_code from anon, authenticated;
revoke all on public.gift_code_attempt from anon, authenticated;

-- Redeems the code with hash p_hash for p_player at p_now, in one transaction, and says what happened:
-- 'limited'      ten or more wrong guesses by this player in the last hour; the code is not looked at.
-- 'unknown'      no such code; counts as a wrong guess.
-- 'alreadyYours' this player redeemed it before; nothing new.
-- 'used'         someone else redeemed it; counts as a wrong guess.
-- 'owned'        this player already owns the code's platform; the code stays unused.
-- 'redeemed'     the code is now this player's, with an entitlement for its platform, source 'gift code'.
-- The player's advisory lock runs one player's redeems one at a time, so the limit and the 'owned' check hold under
-- racing calls; the code row's lock gives one winner when two players race for one code.
create or replace function public.redeem_gift_code(p_hash text, p_player uuid, p_now bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.gift_code;
  wrong integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('redeem_gift_code ' || p_player::text));

  delete from public.gift_code_attempt
  where player = p_player and attempted_at <= p_now - 3600000;

  select count(*) into wrong from public.gift_code_attempt where player = p_player;
  if wrong >= 10 then
    return 'limited';
  end if;

  select * into c from public.gift_code where code_hash = p_hash for update;

  if not found then
    insert into public.gift_code_attempt (player, attempted_at) values (p_player, p_now);
    return 'unknown';
  end if;

  if c.redeemed_by = p_player then
    return 'alreadyYours';
  end if;

  if c.redeemed_by is not null then
    insert into public.gift_code_attempt (player, attempted_at) values (p_player, p_now);
    return 'used';
  end if;

  perform 1 from public.entitlement where player = p_player and platform = c.platform;
  if found then
    return 'owned';
  end if;

  update public.gift_code set redeemed_by = p_player, redeemed_at = p_now where code_hash = p_hash;
  insert into public.entitlement (player, platform, source, created_at)
  values (p_player, c.platform, 'gift code', p_now);
  return 'redeemed';
end;
$$;

revoke execute on function public.redeem_gift_code(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.redeem_gift_code(text, uuid, bigint) to service_role;
