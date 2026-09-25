-- ─────────────────────────────────────────
-- ATOMIC MEDICATION CREATE RPC
-- createMedication() in both apps' lib/medications.ts previously ran as
-- two separate client-side requests (insert medications, then insert
-- medication_schedule_times) with no transaction tying them together —
-- a dropped connection between the two could leave a medication created
-- with no schedule times, silently missing from every schedule/dashboard
-- view. Same pattern as update_medication/set_medication_status: security
-- invoker (the default), so the "own medications" RLS policy still
-- applies (insert requires user_id = auth.uid()), single transaction.
--
-- p_medication is a JSON object of the medications columns the wizard
-- sets (see the field list in the function body) — profile_id may be a
-- JSON null. `dose` is computed here from dose_amount/dose_unit/dose_form
-- (concat_ws, matching update_medication above) rather than passed in.
-- p_schedule_times is a JSON array of {reminder_time, quantity_per_dose}
-- for the new medication's individual (non-group) schedule rows.
-- ─────────────────────────────────────────
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
    inventory_enabled
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
    v_inventory_enabled
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
