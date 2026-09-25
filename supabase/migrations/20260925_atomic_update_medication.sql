-- ─────────────────────────────────────────
-- ATOMIC MEDICATION UPDATE RPC
-- updateMedication() in both apps' lib/medications.ts previously ran as
-- four separate client-side requests (update medications, maybe insert
-- medication_dose_changes, delete medication_schedule_times, insert
-- medication_schedule_times) with no transaction tying them together —
-- a dropped connection or a constraint violation partway through could
-- leave a medication updated but with its individual schedule times
-- wiped and never replaced. Ported from rx-tracker-web's/rx-tracker-app's
-- existing updateMedication logic (inventory-just-enabled handling, dose
-- change detection) into a single plpgsql function, same pattern as
-- record_dose/edit_dose_log below: security invoker (the default), so
-- the "own medications"/"own schedule times" RLS policies still apply
-- inside it, and `for update` locks the row for the duration.
--
-- p_medication is a JSON object of the medications columns this form can
-- edit (see the field list in the function body) — profile_id may be a
-- JSON null. `dose` is computed here from dose_amount/dose_unit/dose_form
-- (concat_ws, matching update_prescribed_dose above) rather than passed
-- in, so the two clients can't drift on how that string is built.
-- p_schedule_times is a JSON array of {reminder_time, quantity_per_dose}
-- for this medication's individual (non-group) schedule rows; group-owned
-- rows are untouched, matching the existing delete-then-insert scope.
-- ─────────────────────────────────────────
create or replace function update_medication(
  p_medication_id uuid,
  p_medication jsonb,
  p_schedule_times jsonb default '[]'::jsonb
)
returns void
language plpgsql
as $$
declare
  v_existing medications%rowtype;
  v_inventory_enabled boolean;
  v_inventory_just_enabled boolean;
  v_starting_quantity numeric;
  v_current_quantity numeric;
  v_new_dose_amount numeric;
  v_new_dose_unit text;
  v_old_dose_unit text;
begin
  select * into v_existing
    from medications
   where id = p_medication_id
   for update;

  if not found then
    raise exception 'Medication not found';
  end if;

  v_inventory_enabled := coalesce((p_medication->>'inventory_enabled')::boolean, false);
  v_inventory_just_enabled := v_inventory_enabled and not v_existing.inventory_enabled;

  v_starting_quantity := case
    when not v_inventory_enabled then null
    when v_inventory_just_enabled then (p_medication->>'starting_quantity')::numeric
    else v_existing.starting_quantity
  end;

  v_current_quantity := case
    when not v_inventory_enabled then null
    when v_inventory_just_enabled or v_existing.current_quantity is null
      then (p_medication->>'starting_quantity')::numeric
    else v_existing.current_quantity
  end;

  v_new_dose_amount := (p_medication->>'dose_amount')::numeric;
  v_new_dose_unit := coalesce(trim(p_medication->>'dose_unit'), '');
  v_old_dose_unit := coalesce(trim(v_existing.dose_unit), '');

  update medications set
    profile_id = nullif(p_medication->>'profile_id', '')::uuid,
    name = p_medication->>'name',
    dose = concat_ws(' ', v_new_dose_amount, nullif(v_new_dose_unit, ''), nullif(p_medication->>'dose_form', '')),
    dose_amount = v_new_dose_amount,
    dose_unit = nullif(v_new_dose_unit, ''),
    dose_form = nullif(p_medication->>'dose_form', ''),
    instructions = coalesce(p_medication->>'instructions', ''),
    schedule_mode = p_medication->>'schedule_mode',
    interval_hours = (p_medication->>'interval_hours')::smallint,
    first_dose_time = nullif(p_medication->>'first_dose_time', '')::time,
    as_needed = coalesce((p_medication->>'as_needed')::boolean, false),
    medication_type = p_medication->>'medication_type',
    inventory_type = p_medication->>'inventory_type',
    inventory_unit = p_medication->>'inventory_unit',
    starting_quantity = v_starting_quantity,
    current_quantity = v_current_quantity,
    quantity_per_dose = (p_medication->>'quantity_per_dose')::numeric,
    low_supply_threshold = coalesce((p_medication->>'low_supply_threshold')::int, 0),
    track_dose_feedback = coalesce(p_medication->>'feedback_type', 'none') <> 'none',
    feedback_type = coalesce(p_medication->>'feedback_type', 'none'),
    start_date = nullif(p_medication->>'start_date', '')::date,
    end_date = nullif(p_medication->>'end_date', '')::date,
    dashboard_enabled = coalesce((p_medication->>'dashboard_enabled')::boolean, true),
    reminders_enabled = coalesce((p_medication->>'reminders_enabled')::boolean, true),
    adherence_enabled = coalesce((p_medication->>'adherence_enabled')::boolean, true),
    inventory_enabled = v_inventory_enabled,
    updated_at = now()
  where id = p_medication_id;

  if v_existing.dose_amount is distinct from v_new_dose_amount
     or v_old_dose_unit is distinct from v_new_dose_unit then
    insert into medication_dose_changes (
      medication_id, old_dose_amount, old_dose_unit, new_dose_amount, new_dose_unit
    ) values (
      p_medication_id, v_existing.dose_amount, v_old_dose_unit, v_new_dose_amount, v_new_dose_unit
    );
  end if;

  -- Only this medication's individual (group_id is null) schedule times —
  -- group-owned rows are managed exclusively by the group sync trigger.
  delete from medication_schedule_times
   where medication_id = p_medication_id
     and group_id is null;

  insert into medication_schedule_times (medication_id, reminder_time, quantity_per_dose)
  select p_medication_id,
         (elem->>'reminder_time')::time,
         (elem->>'quantity_per_dose')::numeric
    from jsonb_array_elements(p_schedule_times) as elem;
end;
$$;

grant execute on function update_medication(uuid, jsonb, jsonb) to authenticated;
