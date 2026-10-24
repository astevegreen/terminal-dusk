-- A turn alert stays live while its player is still waiting on that turn (#267). In a simultaneous decision
-- both players are alerted at the same seq; when one answers, the match's seq moves on but the other is still
-- waiting, so submit raises their alert's waiting_seq to the new seq (SupabaseNotifyStore.keep). The sweep
-- emails an alert only while the match is at its waiting_seq.

-- The latest seq at which the player was known to be still waiting on the alerted turn. Existing rows wait at
-- their own seq.
alter table public.notify_queue add column waiting_seq integer;
update public.notify_queue set waiting_seq = seq;
alter table public.notify_queue alter column waiting_seq set not null;

-- As before (20261024000000_notify_queue.sql), and a stored alert waits at its own seq: a new alert, or one a
-- higher seq replaces, gets waiting_seq = seq. Any waiting_seq given in p_alerts is ignored.
create or replace function public.queue_turn_alerts(p_alerts jsonb)
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
    insert into public.notify_queue as q (match_id, player, seq, queued_at, seen_seq, sent_at, waiting_seq)
    values (a.match_id, a.player, a.seq, a.queued_at, null, null, a.seq)
    on conflict (match_id, player) do update set
      seq = excluded.seq,
      queued_at = excluded.queued_at,
      seen_seq = null,
      sent_at = null,
      waiting_seq = excluded.seq
    where q.seq < excluded.seq;
  end loop;
end;
$$;

-- Replacing a function keeps its privileges, but they are restated so this file says who may run it: only
-- the server's service role.
revoke execute on function public.queue_turn_alerts(jsonb) from public, anon, authenticated;
grant execute on function public.queue_turn_alerts(jsonb) to service_role;
