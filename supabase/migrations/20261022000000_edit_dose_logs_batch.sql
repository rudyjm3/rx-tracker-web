-- ─────────────────────────────────────────
-- ATOMIC BATCH DOSE LOG EDIT (calendar "Edit all — {Group}")
-- Both apps' group bulk edit used to call edit_dose_log once per member
-- from the client, so a failure partway through left the earlier members
-- already committed (the mobile app tried a best-effort client-side
-- rollback, which could itself fail). This applies the whole batch in one
-- function call — one transaction — so either every row is edited or none
-- are.
--
-- Delegates each row to edit_dose_log so the status/inventory logic lives
-- in exactly one place. Security invoker (the default), like
-- edit_dose_log: the "own dose logs" / "own medications" RLS policies
-- decide what the caller can see and change, so another user's log ids
-- are simply invisible and rejected up front.
--
-- p_edits is a JSON array of objects with the edit_dose_log parameters
-- as keys, minus the p_ prefix: log_id, status, taken_at, pain_level,
-- mood_level, note, quantity_per_dose, inventory_enabled. log_id and
-- status are required; the rest follow edit_dose_log's defaults when
-- omitted or null. An empty array is a no-op. Capped at 100 edits per
-- call; log_ids must be distinct.
-- ─────────────────────────────────────────
create or replace function edit_dose_logs_batch(p_edits jsonb)
returns void
language plpgsql
as $$
declare
  c_max_edits constant int := 100;
  v_ids uuid[];
  v_visible int;
  v_edit jsonb;
begin
  if p_edits is null or jsonb_typeof(p_edits) <> 'array' then
    raise exception 'p_edits must be a JSON array';
  end if;

  if jsonb_array_length(p_edits) = 0 then
    return;
  end if;

  if jsonb_array_length(p_edits) > c_max_edits then
    raise exception 'Too many dose log edits (max %)', c_max_edits;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_edits) as e
     where jsonb_typeof(e) <> 'object'
        or nullif(e->>'log_id', '') is null
        or nullif(e->>'status', '') is null
  ) then
    raise exception 'Each edit needs a log_id and a status';
  end if;

  select array_agg((e->>'log_id')::uuid)
    into v_ids
    from jsonb_array_elements(p_edits) as e;

  if (select count(distinct id) from unnest(v_ids) as id) <> cardinality(v_ids) then
    raise exception 'Duplicate log_id in edits';
  end if;

  -- RLS filters this to the caller's own rows, so a foreign or missing
  -- id shows up as a short count before anything has been written.
  select count(*) into v_visible from dose_logs where id = any(v_ids);
  if v_visible <> cardinality(v_ids) then
    raise exception 'Dose log not found';
  end if;

  -- Take every row lock up front in one fixed order: all the dose logs by
  -- id, then their medications by id. That is the same dose_log ->
  -- medication order edit_dose_log uses on its own, so overlapping
  -- batches (even for different dates of the same group, whose log ids
  -- sort differently than their medication ids) and single edits can't
  -- wait on each other in a cycle.
  perform 1 from dose_logs where id = any(v_ids) order by id for update;
  perform 1 from medications
   where id in (select medication_id from dose_logs where id = any(v_ids))
   order by id for update;

  for v_edit in
    select e from jsonb_array_elements(p_edits) as e
  loop
    perform edit_dose_log(
      (v_edit->>'log_id')::uuid,
      v_edit->>'status',
      (v_edit->>'taken_at')::timestamptz,
      (v_edit->>'pain_level')::smallint,
      (v_edit->>'mood_level')::smallint,
      v_edit->>'note',
      (v_edit->>'quantity_per_dose')::numeric,
      coalesce((v_edit->>'inventory_enabled')::boolean, false)
    );
  end loop;
end;
$$;

grant execute on function edit_dose_logs_batch(jsonb) to authenticated;
