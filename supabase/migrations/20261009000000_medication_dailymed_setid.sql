-- Remember the exact DailyMed SPL document a medication's strength matches.
--
-- Picking a name+strength suggestion in the medication autocomplete (see
-- app/api/dailymed-proxy/route.ts, mode=ndc_search) stores the matching
-- openFDA NDC listing's spl_set_id here, so the details modal can load that
-- exact label/media instead of re-searching by drug name (which returned
-- whichever strength's SPL openFDA listed first). Nullable: medications
-- added before this, or without using the autocomplete, have none and fall
-- back to a strength-aware NDC lookup.
--
-- create_medication / update_medication enumerate their columns, so both are
-- redefined to carry the new field. update_medication keeps the stored value
-- when the key is absent from p_medication (clients that predate this
-- column), and update_prescribed_dose clears it because changing the dose
-- invalidates the strength match.
alter table medications add column if not exists dailymed_setid text;

create or replace function create_medication(
  p_medication jsonb,
  p_schedule_times jsonb default '[]'::jsonb
)
returns medications
language plpgsql
as $$
declare
  v_medication medications%rowtype;
  v_inventory_enabled boolean;
  v_starting_quantity numeric;
  v_dose_amount numeric;
  v_dose_unit text;
begin
  v_inventory_enabled := coalesce((p_medication->>'inventory_enabled')::boolean, false);
  v_starting_quantity := case when v_inventory_enabled then (p_medication->>'starting_quantity')::numeric else null end;
  v_dose_amount := (p_medication->>'dose_amount')::numeric;
  v_dose_unit := nullif(trim(p_medication->>'dose_unit'), '');

  insert into medications (
    user_id, profile_id, name, dose, dose_amount, dose_unit, dose_form,
    instructions, schedule_mode, interval_hours, first_dose_time, as_needed,
    medication_type, inventory_type, inventory_unit, starting_quantity,
    current_quantity, quantity_per_dose, low_supply_threshold,
    track_dose_feedback, feedback_type, start_date, end_date, active,
    setup_status, dashboard_enabled, reminders_enabled, adherence_enabled,
    inventory_enabled, dailymed_setid
  ) values (
    (select auth.uid()),
    nullif(p_medication->>'profile_id', '')::uuid,
    p_medication->>'name',
    concat_ws(' ', v_dose_amount, v_dose_unit, nullif(p_medication->>'dose_form', '')),
    v_dose_amount,
    v_dose_unit,
    nullif(p_medication->>'dose_form', ''),
    coalesce(p_medication->>'instructions', ''),
    p_medication->>'schedule_mode',
    (p_medication->>'interval_hours')::smallint,
    nullif(p_medication->>'first_dose_time', '')::time,
    coalesce((p_medication->>'as_needed')::boolean, false),
    p_medication->>'medication_type',
    p_medication->>'inventory_type',
    p_medication->>'inventory_unit',
    v_starting_quantity,
    v_starting_quantity,
    (p_medication->>'quantity_per_dose')::numeric,
    coalesce((p_medication->>'low_supply_threshold')::int, 0),
    coalesce(p_medication->>'feedback_type', 'none') <> 'none',
    coalesce(p_medication->>'feedback_type', 'none'),
    nullif(p_medication->>'start_date', '')::date,
    nullif(p_medication->>'end_date', '')::date,
    true,
    'active',
    coalesce((p_medication->>'dashboard_enabled')::boolean, true),
    coalesce((p_medication->>'reminders_enabled')::boolean, true),
    coalesce((p_medication->>'adherence_enabled')::boolean, true),
    v_inventory_enabled,
    nullif(trim(p_medication->>'dailymed_setid'), '')
  )
  returning * into v_medication;

  insert into medication_schedule_times (medication_id, reminder_time, quantity_per_dose)
  select v_medication.id,
         (elem->>'reminder_time')::time,
         (elem->>'quantity_per_dose')::numeric
    from jsonb_array_elements(p_schedule_times) as elem;

  return v_medication;
end;
$$;

grant execute on function create_medication(jsonb, jsonb) to authenticated;

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
    -- An omitted key (older clients) keeps the stored match; an explicit
    -- JSON null or '' clears it.
    dailymed_setid = case
      when p_medication ? 'dailymed_setid' then nullif(trim(p_medication->>'dailymed_setid'), '')
      else dailymed_setid
    end,
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

create or replace function update_prescribed_dose(
  p_medication_id uuid,
  p_dose_amount numeric,
  p_dose_unit text,
  p_comment text default ''
)
returns boolean
language plpgsql
as $$
declare
  v_existing medications%rowtype;
  v_old_dose_unit text;
  v_new_dose_unit text;
begin
  select *
    into v_existing
    from medications
   where id = p_medication_id
   for update;

  if not found then
    raise exception 'Medication not found';
  end if;

  v_old_dose_unit := coalesce(trim(v_existing.dose_unit), '');
  v_new_dose_unit := coalesce(trim(p_dose_unit), '');

  if v_existing.dose_amount is not distinct from p_dose_amount
     and v_old_dose_unit = v_new_dose_unit then
    return false;
  end if;

  update medications
     set dose = concat_ws(' ', p_dose_amount, nullif(v_new_dose_unit, ''), nullif(dose_form, '')),
         dose_amount = p_dose_amount,
         dose_unit = nullif(v_new_dose_unit, ''),
         -- The saved DailyMed SPL was matched to the old strength.
         dailymed_setid = null,
         updated_at = now()
   where id = p_medication_id;

  insert into medication_dose_changes (
    medication_id,
    old_dose_amount,
    old_dose_unit,
    new_dose_amount,
    new_dose_unit,
    comment
  ) values (
    p_medication_id,
    v_existing.dose_amount,
    v_old_dose_unit,
    p_dose_amount,
    v_new_dose_unit,
    coalesce(p_comment, '')
  );

  return true;
end;
$$;
