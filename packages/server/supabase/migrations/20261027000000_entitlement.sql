-- Entitlements: which full-game copies a player owns (docs/architecture.md, Decision 5, "Accounts and purchases").
-- Rows come only from verified sources (store ownership checks, receipts, checkout webhooks, gift codes), which the
-- server writes with the service role. A signed-in player may read their own rows; no client role may write any.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables.

create table public.entitlement (
  id uuid primary key default gen_random_uuid(),
  -- No foreign key on user ids, like the match table's player columns.
  player uuid not null,
  -- The platforms in packages/host/src/entitlement.ts (PLATFORMS).
  platform text not null check (platform in ('web', 'steam', 'ios', 'android')),
  -- Where the copy came from: a store, a checkout, a gift code.
  source text not null check (length(source) > 0),
  -- The store's receipt or order reference, when there is one.
  receipt_ref text,
  created_at bigint not null
);

create index entitlement_player on public.entitlement (player);

-- Clients may only read, and only signed in. Truncate is revoked too, because it would skip row-level security.
alter table public.entitlement enable row level security;
revoke all on public.entitlement from anon, authenticated;
grant select on public.entitlement to authenticated;

create policy "owner reads own entitlements" on public.entitlement
  for select to authenticated
  using (player = (select auth.uid()));
