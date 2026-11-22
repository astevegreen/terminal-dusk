-- Which side the host played for in a step (#605, the "defaultAnswer" deadline rule): when a side misses its deadline
-- the host answers for it, and the step's three event rows (one per viewer) name that side here. Null for an
-- ordinary step. It holds a side's name only; nothing hidden. Clients read it under the same row-level policies as
-- the rest of the row.
--
-- commit_match and accept_invite need no change: they fill match_event with jsonb_populate_recordset, which takes
-- every column of the table, so the rows packages/server/src/rows.ts builds (with a `stand_in` key) save as they are.
alter table public.match_event
  add column stand_in text check (stand_in in ('lio', 'sae'));
