-- ─────────────────────────────────────────
-- ATOMIC MEDICATION STATUS CHANGE RPC
-- deactivateMedication()/activateMedication() ran as two separate
-- requests (update medications.active, then insert
-- medication_status_events) with nothing tying them together — a
-- dropped connection between them could leave a medication discontinued
-- with no audit event, or (on the resume path) reactivated with the
-- history silently missing. Same pattern as update_medication above:
-- security invoker, `for update` row lock, single transaction.
-- ─────────────────────────────────────────
create or replace function set_medication_status(
  p_medication_id uuid,
  p_active boolean,
  p_event text,
  p_reason text default '',
  p_comment text default ''
)
returns void
language plpgsql
as $$
begin
  perform 1 from medications where id = p_medication_id for update;

  if not found then
    raise exception 'Medication not found';
  end if;

  update medications
     set active = p_active,
         updated_at = now()
   where id = p_medication_id;

  insert into medication_status_events (medication_id, event, reason, comment)
  values (p_medication_id, p_event, coalesce(p_reason, ''), coalesce(p_comment, ''));
end;
$$;

grant execute on function set_medication_status(uuid, boolean, text, text, text) to authenticated;
