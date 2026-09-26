-- ─────────────────────────────────────────
-- ATOMIC SIDE EFFECT MULTI-INSERT RPC
-- Both apps' side-effect logging UI lets a user select multiple tags at
-- once and previously submitted one addSideEffect() call per selected
-- tag via Promise.all — independent requests, no transaction. A dropped
-- connection or per-row failure partway through could leave some rows
-- committed and others not, and retrying then duplicates the ones that
-- already succeeded. Same pattern as create_group/update_group above:
-- security invoker (the default), `for update` row lock on the parent
-- row, all row inserts done inside this one function so the whole
-- submission is one transaction.
--
-- p_descriptions is a JSON array of description strings (the tag names
-- the caller already resolved, same as today's per-tag loop) — one
-- side_effects row is inserted per element, sharing the same
-- occurred_date/severity/note.
-- ─────────────────────────────────────────
create or replace function add_side_effects(
  p_medication_id uuid,
  p_occurred_date date,
  p_descriptions jsonb,
  p_severity text,
  p_note text
)
returns void
language plpgsql
as $$
begin
  perform 1 from medications where id = p_medication_id for update;

  if not found then
    raise exception 'Medication not found';
  end if;

  insert into side_effects (medication_id, occurred_date, description, severity, note)
  select p_medication_id,
         p_occurred_date,
         elem #>> '{}',
         p_severity,
         p_note
    from jsonb_array_elements(p_descriptions) as elem;
end;
$$;

grant execute on function add_side_effects(uuid, date, jsonb, text, text) to authenticated;
