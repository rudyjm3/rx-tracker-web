-- Edit / delete a logged refill. Both lock the medication row (like
-- log_refill) and shift current_quantity by the change in amount, and
-- shift the pills_on_hand snapshot on this and later history rows so the
-- "on hand after" figures stay consistent.
create or replace function update_refill(
  p_refill_id uuid,
  p_amount numeric,
  p_refill_date date,
  p_note text default ''
)
returns void
language plpgsql
as $$
declare
  v_med uuid;
  v_old numeric;
  v_created timestamptz;
  v_delta numeric;
begin
  select medication_id, amount, created_at into v_med, v_old, v_created
    from medication_refills
   where id = p_refill_id and entry_type = 'refill';
  if v_med is null then
    raise exception 'Refill not found';
  end if;

  perform 1 from medications where id = v_med for update;

  v_delta := p_amount - v_old;

  update medication_refills
     set amount = p_amount,
         refill_date = coalesce(p_refill_date, refill_date),
         note = coalesce(p_note, '')
   where id = p_refill_id;

  update medication_refills
     set pills_on_hand = greatest(pills_on_hand + v_delta, 0)
   where medication_id = v_med and created_at >= v_created;

  update medications
     set current_quantity = greatest(coalesce(current_quantity, 0) + v_delta, 0),
         updated_at = now()
   where id = v_med;
end;
$$;

create or replace function delete_refill(p_refill_id uuid)
returns void
language plpgsql
as $$
declare
  v_med uuid;
  v_amount numeric;
  v_created timestamptz;
begin
  select medication_id, amount, created_at into v_med, v_amount, v_created
    from medication_refills
   where id = p_refill_id and entry_type = 'refill';
  if v_med is null then
    raise exception 'Refill not found';
  end if;

  perform 1 from medications where id = v_med for update;

  update inventory_transactions set refill_id = null where refill_id = p_refill_id;
  delete from medication_refills where id = p_refill_id;

  update medication_refills
     set pills_on_hand = greatest(pills_on_hand - v_amount, 0)
   where medication_id = v_med and created_at > v_created;

  update medications
     set current_quantity = greatest(coalesce(current_quantity, 0) - v_amount, 0),
         updated_at = now()
   where id = v_med;
end;
$$;

grant execute on function update_refill(uuid, numeric, date, text) to authenticated;
grant execute on function delete_refill(uuid) to authenticated;
