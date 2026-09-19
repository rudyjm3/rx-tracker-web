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

alter table medication_schedule_times
  add column group_id uuid references medication_groups(id) on delete set null;

create index if not exists idx_medication_schedule_times_group_id
  on medication_schedule_times(group_id);

-- Replace the old blanket unique constraint with two partial indexes: an
-- individual (group_id is null) dose stays unique per medication+time, and a
-- group-owned dose is unique per medication+time+group -- so a medication
-- can have both an individual dose and a group-owned dose at the same time,
-- or belong to two different groups that happen to share a time.
alter table medication_schedule_times
  drop constraint if exists medication_schedule_times_medication_id_reminder_time_key;

create unique index if not exists medication_schedule_times_individual_uidx
  on medication_schedule_times (medication_id, reminder_time)
  where group_id is null;

create unique index if not exists medication_schedule_times_group_uidx
  on medication_schedule_times (medication_id, reminder_time, group_id)
  where group_id is not null;

-- Backfill: link existing schedule-time rows that already coincide with
-- their group's scheduled_time under the old string-matching rule, so
-- today's data keeps its grouping once the app reads group_id directly.
update medication_schedule_times mst
set group_id = gm.group_id
from medication_group_members gm
join medication_groups g on g.id = gm.group_id
where mst.medication_id = gm.medication_id
  and mst.reminder_time = g.scheduled_time
  and mst.group_id is null;

-- Keep medication_schedule_times.group_id in sync with group membership and
-- each group's scheduled_time going forward, so grouping can be decided
-- structurally rather than by comparing time strings at read time.
create or replace function sync_medication_group_schedule_time()
returns trigger
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
  where id = new.group_id;

  if v_group_time is null then
    return new;
  end if;

  select id into v_row_id
  from medication_schedule_times
  where medication_id = new.medication_id and group_id = new.group_id
  limit 1;

  if v_row_id is not null then
    update medication_schedule_times
      set reminder_time = v_group_time
      where id = v_row_id
        and reminder_time is distinct from v_group_time;
    return new;
  end if;

  update medication_schedule_times
    set group_id = new.group_id
    where id = (
      select id from medication_schedule_times
      where medication_id = new.medication_id
        and reminder_time = v_group_time
        and group_id is null
      limit 1
    )
    returning id into v_row_id;

  if v_row_id is null then
    insert into medication_schedule_times (medication_id, reminder_time, group_id, quantity_per_dose)
    values (new.medication_id, v_group_time, new.group_id, new.quantity_per_dose)
    on conflict do nothing;
  end if;

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
