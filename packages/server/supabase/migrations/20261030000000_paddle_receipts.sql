-- Checkout receipts (docs/architecture.md, Decision 5, "Accounts and purchases"): Paddle, the merchant of record
-- for web purchases, tells the paddle-webhook function when an order is paid or refunded. It delivers at least once
-- and in no set order, so one receipt gets at most one entitlement and a refunded receipt gets none, whichever
-- message arrives first. Only the server writes or reads these, with the service role.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables.

-- A Paddle transaction buys one copy. Other sources keep their own rules.
create unique index entitlement_paddle_receipt on public.entitlement (source, receipt_ref)
  where receipt_ref is not null and source = 'paddle';

-- Refunded receipts, kept even when no entitlement was ever written for them.
create table public.entitlement_refund (
  source text not null check (length(source) > 0),
  receipt_ref text not null check (length(receipt_ref) > 0),
  refunded_at bigint not null,
  primary key (source, receipt_ref)
);

-- Paid orders no player could be found for, for a person to settle. It holds no player id and no message.
create table public.checkout_unmatched (
  source text not null check (length(source) > 0),
  receipt_ref text not null check (length(receipt_ref) > 0),
  reason text not null check (reason in ('noPlayerId', 'badPlayerId', 'unknownPlayer')),
  created_at bigint not null,
  primary key (source, receipt_ref)
);

-- No client role may read or write either table. Truncate is revoked too, because it would skip row-level security.
alter table public.entitlement_refund enable row level security;
alter table public.checkout_unmatched enable row level security;
revoke all on public.entitlement_refund from anon, authenticated;
revoke all on public.checkout_unmatched from anon, authenticated;

-- Writes a receipt's entitlement, unless it has one or was refunded: 'granted', 'already' or 'refunded'. The lock
-- is held to the end of the transaction, so a grant and a refund of one receipt never overlap.
create function public.grant_receipt(
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
  if exists (select 1 from public.entitlement e where e.source = p_source and e.receipt_ref = p_receipt_ref) then
    return 'already';
  end if;
  insert into public.entitlement (player, platform, source, receipt_ref, created_at)
  values (p_player, p_platform, p_source, p_receipt_ref, p_now);
  return 'granted';
end;
$$;

-- Records a receipt's refund (the first time is kept) and removes its entitlement: 'revoked', or 'remembered'
-- when it had none.
create function public.revoke_receipt(p_source text, p_receipt_ref text, p_now bigint) returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_receipt_ref, 0));
  insert into public.entitlement_refund (source, receipt_ref, refunded_at)
  values (p_source, p_receipt_ref, p_now)
  on conflict (source, receipt_ref) do nothing;
  delete from public.entitlement e where e.source = p_source and e.receipt_ref = p_receipt_ref;
  if found then
    return 'revoked';
  end if;
  return 'remembered';
end;
$$;

revoke execute on function public.grant_receipt(uuid, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.grant_receipt(uuid, text, text, text, bigint) to service_role;
revoke execute on function public.revoke_receipt(text, text, bigint) from public, anon, authenticated;
grant execute on function public.revoke_receipt(text, text, bigint) to service_role;
