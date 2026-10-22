-- Turn alerts waiting to be emailed (docs/architecture.md, Decision 5, `notify_queue`: pending notifications).
-- One row per (match, player): the latest turn that player was alerted to, whether they have seen it, and
-- whether its email went out. packages/server/src/supabaseNotifyStore.ts reads and writes it.
-- Only the server uses it, with the service role: clients get no policy and no privilege, like match_secret.
-- Times are whole-number milliseconds since 1970 (bigint), as in the match tables.

create table public.notify_queue (
  -- Deleting a match (a finished one, or a test's) removes its alerts too.
  match_id text not null references public.match (match_id) on delete cascade,
  -- No foreign key on user ids, like the match table's player columns.
  player uuid not null,
  -- The match's seq when the alert was queued, and when.
  seq integer not null,
  queued_at bigint not null,
  -- The seq the player said they had seen, once it reached this alert's seq; null until then.
  seen_seq integer,
  -- When the alert's email went out (or the sweep dropped it); null until then.
  sent_at bigint,
  primary key (match_id, player)
);

-- The sweep asks for the alerts not seen and not sent, queued long enough ago, oldest first.
create index notify_queue_due_idx on public.notify_queue (queued_at, match_id, player)
  where seen_seq is null and sent_at is null;

-- Row-level security with no policy at all, and no client privilege (truncate would skip row-level security).
alter table public.notify_queue enable row level security;
revoke all on public.notify_queue from anon, authenticated;

-- Queues turn alerts, one at a time in the order given. p_alerts is a list of
-- {match_id, player, seq, queued_at}. A new (match, player) is inserted. A higher seq replaces the stored alert
-- as a fresh one: the new seq and queued_at, not seen, not sent. An older or equal seq changes nothing.
-- One at a time, so the same (match, player) twice in one list is fine: the second is an equal seq.
create function public.queue_turn_alerts(p_alerts jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.notify_queue;
begin
  for a in
    select r.*
    from jsonb_array_elements(p_alerts) with ordinality as e(alert, n)
    cross join lateral jsonb_populate_record(null::public.notify_queue, e.alert) as r
    order by e.n
  loop
    insert into public.notify_queue as q (match_id, player, seq, queued_at, seen_seq, sent_at)
    values (a.match_id, a.player, a.seq, a.queued_at, null, null)
    on conflict (match_id, player) do update set
      seq = excluded.seq,
      queued_at = excluded.queued_at,
      seen_seq = null,
      sent_at = null
    where q.seq < excluded.seq;
  end loop;
end;
$$;

-- Only the server's service role may run it. Supabase grants execute on new functions to the client roles by
-- default, so it is taken away from them (and from public) by name.
revoke execute on function public.queue_turn_alerts(jsonb) from public, anon, authenticated;
grant execute on function public.queue_turn_alerts(jsonb) to service_role;
