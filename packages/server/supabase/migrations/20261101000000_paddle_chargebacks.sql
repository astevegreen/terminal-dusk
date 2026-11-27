-- Chargebacks (docs/architecture.md, Decision 5, "Accounts and purchases"): when a buyer's bank takes a web payment
-- back, the copy goes; when that chargeback is reversed, it comes back. Paddle sends these at least once and in no
-- set order, so each receipt keeps the latest time of both and is charged back while the chargeback is the newer.
-- A refund is final (public.entitlement_refund) and no reversal lifts it. Only the server writes or reads this,
-- with the service role.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables; 0 means it never happened.

create table public.entitlement_chargeback (
  source text not null check (length(source) > 0),
  receipt_ref text not null check (length(receipt_ref) > 0),
  charged_back_at bigint not null default 0,
  reversed_at bigint not null default 0,
  -- The buyer, held while the receipt is charged back so a reversal knows whom to give the copy; account deletion
  -- clears it. No foreign key, like public.entitlement.player.
  player uuid,
  platform text,
  primary key (source, receipt_ref),
  check ((player is null) = (platform is null))
);

-- No client role may read or write it. Truncate is revoked too, because it would skip row-level security.
alter table public.entitlement_chargeback enable row level security;
revoke all on public.entitlement_chargeback from anon, authenticated;

-- As before (20261030000000_paddle_receipts.sql), and a charged-back receipt gets no entitlement: its buyer is held
-- instead, and the answer is 'chargedBack'. Replacing the function keeps who may run it.
create or replace function public.grant_receipt(
  p_player uuid,
  p_platform text,
  p_source text,
  p_receipt_ref text,
  p_now bigint
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_receipt_ref, 0));
  if exists (
    select 1 from public.entitlement_refund r where r.source = p_source and r.receipt_ref = p_receipt_ref
  ) then
    return 'refunded';
  end if;
  update public.entitlement_chargeback c
  set player = coalesce(c.player, p_player), platform = coalesce(c.platform, p_platform)
  where c.source = p_source and c.receipt_ref = p_receipt_ref and c.charged_back_at > c.reversed_at;
  if found then
    return 'chargedBack';
  end if;
  if exists (select 1 from public.entitlement e where e.source = p_source and e.receipt_ref = p_receipt_ref) then
    return 'already';
  end if;
  insert into public.entitlement (player, platform, source, receipt_ref, created_at)
  values (p_player, p_platform, p_source, p_receipt_ref, p_now);
  return 'granted';
end;
$$;

-- Records a chargeback made at p_at (the latest is kept). While it is newer than any reversal, it removes the
-- receipt's entitlement and holds its buyer: 'revoked', or 'remembered' when it removed nothing.
create function public.chargeback_receipt(p_source text, p_receipt_ref text, p_at bigint) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  buyer uuid;
  bought_on text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_receipt_ref, 0));
  insert into public.entitlement_chargeback as c (source, receipt_ref, charged_back_at)
  values (p_source, p_receipt_ref, p_at)
  on conflict (source, receipt_ref)
  do update set charged_back_at = greatest(c.charged_back_at, excluded.charged_back_at);
  delete from public.entitlement e
  where e.source = p_source and e.receipt_ref = p_receipt_ref and exists (
    select 1 from public.entitlement_chargeback c
    where c.source = p_source and c.receipt_ref = p_receipt_ref and c.charged_back_at > c.reversed_at
  )
  returning e.player, e.platform into buyer, bought_on;
  if not found then
    return 'remembered';
  end if;
  update public.entitlement_chargeback c
  set player = buyer, platform = bought_on
  where c.source = p_source and c.receipt_ref = p_receipt_ref;
  return 'revoked';
end;
$$;

-- Records a reversal made at p_at (the latest is kept). Once it is as new as any chargeback, the held buyer gets the
-- entitlement again, dated p_now, unless the receipt was refunded or has one: 'restored', or 'remembered'.
create function public.reverse_chargeback(p_source text, p_receipt_ref text, p_at bigint, p_now bigint)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  buyer uuid;
  bought_on text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_receipt_ref, 0));
  insert into public.entitlement_chargeback as c (source, receipt_ref, reversed_at)
  values (p_source, p_receipt_ref, p_at)
  on conflict (source, receipt_ref)
  do update set reversed_at = greatest(c.reversed_at, excluded.reversed_at);
  select c.player, c.platform into buyer, bought_on
  from public.entitlement_chargeback c
  where c.source = p_source and c.receipt_ref = p_receipt_ref and c.charged_back_at <= c.reversed_at;
  if buyer is null
    or exists (
      select 1 from public.entitlement_refund r where r.source = p_source and r.receipt_ref = p_receipt_ref
    )
    or exists (select 1 from public.entitlement e where e.source = p_source and e.receipt_ref = p_receipt_ref)
  then
    return 'remembered';
  end if;
  insert into public.entitlement (player, platform, source, receipt_ref, created_at)
  values (buyer, bought_on, p_source, p_receipt_ref, p_now);
  update public.entitlement_chargeback c
  set player = null, platform = null
  where c.source = p_source and c.receipt_ref = p_receipt_ref;
  return 'restored';
end;
$$;

revoke execute on function public.chargeback_receipt(text, text, bigint) from public, anon, authenticated;
grant execute on function public.chargeback_receipt(text, text, bigint) to service_role;
revoke execute on function public.reverse_chargeback(text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reverse_chargeback(text, text, bigint, bigint) to service_role;
