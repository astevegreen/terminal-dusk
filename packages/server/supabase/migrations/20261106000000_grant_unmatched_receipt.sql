-- Settling an unmatched receipt (docs/architecture.md, Decision 7, "Accounts and purchases"): a paid web order the
-- webhook could not tie to a player waits in public.checkout_unmatched. The owner's command-line tool
-- (tools/unmatched-receipts.mjs) gives the buyer's copy through this function. It runs in one transaction, so a
-- refused or failed grant changes nothing. Only the server calls it, with the service role.

-- Gives p_player the web copy for the unmatched Paddle receipt p_receipt_ref, through public.grant_receipt (so
-- refunds and chargebacks of that receipt work afterwards), and removes the unmatched row. Answers 'granted', or
-- changes nothing and answers: 'unknownReceipt' (no such unmatched row and no copy for it), 'already' (the receipt
-- has its copy: it was granted before), 'unknownPlayer' (p_player is no account), 'refunded' or 'chargedBack'.
create function public.grant_unmatched_receipt(p_receipt_ref text, p_player uuid, p_now bigint) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  outcome text;
begin
  perform pg_advisory_xact_lock(hashtextextended('paddle:' || p_receipt_ref, 0));
  if not exists (
    select 1 from public.checkout_unmatched u where u.source = 'paddle' and u.receipt_ref = p_receipt_ref
  ) then
    if exists (select 1 from public.entitlement e where e.source = 'paddle' and e.receipt_ref = p_receipt_ref) then
      return 'already';
    end if;
    return 'unknownReceipt';
  end if;
  if not exists (select 1 from auth.users a where a.id = p_player) then
    return 'unknownPlayer';
  end if;
  outcome := public.grant_receipt(p_player, 'web', 'paddle', p_receipt_ref, p_now);
  if outcome = 'granted' or outcome = 'already' then
    delete from public.checkout_unmatched u where u.source = 'paddle' and u.receipt_ref = p_receipt_ref;
  end if;
  return outcome;
end;
$$;

revoke execute on function public.grant_unmatched_receipt(text, uuid, bigint) from public, anon, authenticated;
grant execute on function public.grant_unmatched_receipt(text, uuid, bigint) to service_role;
