-- adjust_quantity stamped refill_date with the server's current_date (UTC),
-- so adjustments made in the evening (US timezones) were dated tomorrow.
-- Accept the client's local date, like log_refill does.
drop function if exists adjust_quantity(uuid, numeric, text);

create or replace function adjust_quantity(
  p_medication_id uuid,
  p_new_quantity numeric,
  p_note text default '',
  p_date date default current_date
)
returns void
language plpgsql
as $$
declare
  v_current numeric;
begin
  select current_quantity into v_current
    from medications
   where id = p_medication_id
   for update;

  insert into medication_refills (
    medication_id, refill_date, amount, pills_on_hand, note, entry_type
  )
  values (
    p_medication_id, coalesce(p_date, current_date), p_new_quantity - coalesce(v_current, 0), p_new_quantity,
    coalesce(p_note, ''), 'adjustment'
  );

  update medications
    set current_quantity = p_new_quantity,
        updated_at = now()
    where id = p_medication_id;
end;
$$;

grant execute on function adjust_quantity(uuid, numeric, text, date) to authenticated;
