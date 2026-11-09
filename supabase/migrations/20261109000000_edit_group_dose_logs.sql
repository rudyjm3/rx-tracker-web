-- ─────────────────────────────────────────
-- ATOMIC GROUP DOSE EDIT WITH PENDING AS-NEEDED MEMBERS
-- The calendar's "Edit all — {Group}" edits the group's existing dose logs
-- and, for as-needed members that have no log for that dose yet (e.g. a
-- supplement added to a group), records them with the same status / time /
-- note. Doing those as separate calls let a failed second step leave the
-- group half updated. This runs both in one function call — one
-- transaction — so either everything is saved or nothing is.
--
-- p_edits: the edit_dose_logs_batch array (may be empty).
-- p_pending: a JSON array of objects: medication_id, scheduled_for_date,
-- scheduled_time, status ('taken' | 'skipped'), taken_at (required for
-- 'taken'), note, quantity_per_dose, inventory_enabled. Delegates to
-- record_dose_at_time / record_dose, so inventory and upsert behaviour live
-- in one place. Security invoker, like those functions: RLS applies. Capped
-- at 100 pending rows; an empty array is a no-op.
-- ─────────────────────────────────────────
create or replace function edit_group_dose_logs(p_edits jsonb, p_pending jsonb default '[]'::jsonb)
returns void
language plpgsql
as $$
declare
  c_max_pending constant int := 100;
  v_row jsonb;
begin
  if p_pending is null or jsonb_typeof(p_pending) <> 'array' then
    raise exception 'p_pending must be a JSON array';
  end if;

  if jsonb_array_length(p_pending) > c_max_pending then
    raise exception 'Too many pending dose logs (max %)', c_max_pending;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_pending) as e
     where jsonb_typeof(e) <> 'object'
        or nullif(e->>'medication_id', '') is null
        or nullif(e->>'scheduled_for_date', '') is null
        or nullif(e->>'scheduled_time', '') is null
        or coalesce(e->>'status', '') not in ('taken', 'skipped')
        or (e->>'status' = 'taken' and nullif(e->>'taken_at', '') is null)
  ) then
    raise exception 'Each pending dose needs a medication_id, scheduled_for_date, scheduled_time and a taken/skipped status (taken also needs taken_at)';
  end if;

  if p_edits is null or jsonb_typeof(p_edits) <> 'array' then
    raise exception 'p_edits must be a JSON array';
  end if;

  -- One lock order covering both phases, taken before either runs: the
  -- existing dose logs by id, then every medication touched by either
  -- array by id (the same dose_log -> medication order edit_dose_log uses).
  -- Locking only inside each phase would let two overlapping saves hold
  -- different medication locks and then wait on each other.
  perform 1 from dose_logs
   where id in (select (e->>'log_id')::uuid from jsonb_array_elements(p_edits) as e)
   order by id for update;
  perform 1 from medications
   where id in (
           select medication_id from dose_logs
            where id in (select (e->>'log_id')::uuid from jsonb_array_elements(p_edits) as e)
         )
      or id in (select (e->>'medication_id')::uuid from jsonb_array_elements(p_pending) as e)
   order by id for update;

  perform edit_dose_logs_batch(p_edits);

  for v_row in
    select e from jsonb_array_elements(p_pending) as e
  loop
    if v_row->>'status' = 'taken' then
      perform record_dose_at_time(
        (v_row->>'medication_id')::uuid,
        (v_row->>'scheduled_for_date')::date,
        (v_row->>'scheduled_time')::time,
        (v_row->>'taken_at')::timestamptz,
        (v_row->>'quantity_per_dose')::numeric,
        coalesce((v_row->>'inventory_enabled')::boolean, false),
        null,
        null,
        v_row->>'note'
      );
    else
      perform record_dose(
        (v_row->>'medication_id')::uuid,
        (v_row->>'scheduled_for_date')::date,
        (v_row->>'scheduled_time')::time,
        'skipped',
        (v_row->>'quantity_per_dose')::numeric,
        coalesce((v_row->>'inventory_enabled')::boolean, false)
      );
    end if;
  end loop;
end;
$$;

grant execute on function edit_group_dose_logs(jsonb, jsonb) to authenticated;
