-- Link medication_schedule_times to the medication_group that owns a given
-- reminder time, instead of inferring group membership by comparing time
-- strings at read time. The old approach (matching a medication's own
-- reminder_time against medication_groups.scheduled_time as plain string
-- equality, with nothing keeping them in sync) is the root cause behind
-- "individual alert instead of group alert" bugs: any drift between a
-- group's scheduled_time and a member's own reminder_time (edited
-- independently, or one member individually snoozed) silently drops that
-- medication out of the group for alerting purposes even though
-- medication_group_members still lists it as a member.
--
-- This must run after both medication_schedule_times and medication_groups
-- exist (the FK below references medication_groups), which is already true
-- for a live database this migration is applied to, but matters for
-- supabase/schema.sql's fresh-bootstrap ordering -- kept in sync there.

alter table medication_schedule_times
  add column if not exists group_id uuid references medication_groups(id) on delete set null;

create index if not exists idx_medication_schedule_times_group_id
  on medication_schedule_times(group_id);

-- Uniqueness stays exactly (medication_id, reminder_time), group or not.
-- dose_logs has no schedule-row identity of its own -- it's only ever keyed
-- by (medication_id, scheduled_for_date, scheduled_time) -- so two schedule
-- rows at the same time for the same medication would silently share (and
-- fight over) a single dose_logs row: marking one "taken" would mark both,
-- inventory would only deduct once, and adherence counts could double.
-- Syncing group_id onto an existing row (see below) converts an individual
-- row into a group-owned one in place rather than adding a second row
-- alongside it.

-- Attaches (or creates) the medication_schedule_times row a single group
-- membership owns, converting an existing individual row at the group's
-- time if one exists, or claiming/relocating the row already tagged with
-- this group_id, or inserting a fresh one as a last resort.
create or replace function sync_medication_group_schedule_time_for(
  p_medication_id uuid,
  p_group_id uuid,
  p_quantity_per_dose numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_time time;
  v_row_id uuid;
begin
  select scheduled_time into v_group_time
  from medication_groups
  where id = p_group_id;

  if v_group_time is null then
    return;
  end if;

  select id into v_row_id
  from medication_schedule_times
  where medication_id = p_medication_id and group_id = p_group_id
  limit 1;

  if v_row_id is not null then
    update medication_schedule_times
      set reminder_time = v_group_time
      where id = v_row_id
        and reminder_time is distinct from v_group_time;
    return;
  end if;

  update medication_schedule_times
    set group_id = p_group_id
    where id = (
      select id from medication_schedule_times
      where medication_id = p_medication_id
        and reminder_time = v_group_time
        and group_id is null
      limit 1
    )
    returning id into v_row_id;

  if v_row_id is null then
    -- A different row (an individual dose, or another group's dose) may
    -- already occupy this exact time for this medication -- skip rather
    -- than error; that collision isn't something this function can safely
    -- resolve on its own, and the unique (medication_id, reminder_time)
    -- constraint is what prevents it from silently duplicating a dose_logs
    -- identity.
    insert into medication_schedule_times (medication_id, reminder_time, group_id, quantity_per_dose)
    values (p_medication_id, v_group_time, p_group_id, p_quantity_per_dose)
    on conflict (medication_id, reminder_time) do nothing;
  end if;
end;
$$;

-- Backfill every existing membership now, including ones whose
-- medication_schedule_times.reminder_time had already drifted from the
-- group's scheduled_time (the exact scenario this migration exists to fix)
-- -- not just rows that happen to already match -- so already-broken
-- production data is corrected immediately rather than waiting for a user
-- to happen to edit that group.
do $$
declare
  m record;
begin
  for m in select medication_id, group_id, quantity_per_dose from medication_group_members loop
    perform sync_medication_group_schedule_time_for(m.medication_id, m.group_id, m.quantity_per_dose);
  end loop;
end $$;

-- Keep medication_schedule_times.group_id in sync with group membership and
-- each group's scheduled_time going forward, so grouping can be decided
-- structurally rather than by comparing time strings at read time.
create or replace function sync_medication_group_schedule_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sync_medication_group_schedule_time_for(new.medication_id, new.group_id, new.quantity_per_dose);
  return new;
end;
$$;

drop trigger if exists trg_sync_group_schedule_on_member_change on medication_group_members;
create trigger trg_sync_group_schedule_on_member_change
  after insert or update on medication_group_members
  for each row execute function sync_medication_group_schedule_time();

create or replace function cleanup_medication_group_schedule_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from medication_schedule_times
  where medication_id = old.medication_id
    and group_id = old.group_id;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_group_schedule_on_member_remove on medication_group_members;
create trigger trg_cleanup_group_schedule_on_member_remove
  after delete on medication_group_members
  for each row execute function cleanup_medication_group_schedule_time();

create or replace function propagate_group_scheduled_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_time is distinct from old.scheduled_time then
    update medication_schedule_times
      set reminder_time = new.scheduled_time
      where group_id = new.id;
  end if;

  if new.active = false and old.active = true then
    delete from medication_schedule_times where group_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_propagate_group_scheduled_time on medication_groups;
create trigger trg_propagate_group_scheduled_time
  after update of scheduled_time, active on medication_groups
  for each row execute function propagate_group_scheduled_time();
