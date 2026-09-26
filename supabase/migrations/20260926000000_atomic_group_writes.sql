-- ─────────────────────────────────────────
-- ATOMIC MEDICATION GROUP WRITE RPCs
-- createGroup()/updateGroup() in both apps' lib/medications.ts previously
-- ran as two-plus separate client-side requests (insert/update the group
-- row, delete ALL existing medication_group_members, then reinsert the
-- new member list) with no transaction tying them together. If the
-- reinsert failed after the delete succeeded (a transient network error,
-- a bad medication_id, whatever), the group was left with zero members —
-- and trg_cleanup_group_schedule_on_member_remove reacts to that by
-- clearing those medications' schedule times too, so a failed "save"
-- could silently blow away a real group's membership and scheduling, not
-- just fail cleanly. Same pattern as update_medication/create_medication
-- above: security invoker (the default), `for update` row lock on
-- update_group, all child-row writes done inside the same function so
-- the whole thing is one transaction.
--
-- p_group is a JSON object with name/scheduled_time/profile_id (profile_id
-- may be a JSON null). p_members is a JSON array of
-- {medication_id, quantity_per_dose, sort_order} for the group's member
-- rows; sort_order defaults to the member's position in the array when
-- omitted, matching the client's `m.sort_order ?? i` behavior.
-- ─────────────────────────────────────────
create or replace function create_group(
  p_group jsonb,
  p_members jsonb default '[]'::jsonb
)
returns medication_groups
language plpgsql
as $$
declare
  v_group medication_groups%rowtype;
begin
  insert into medication_groups (
    user_id, profile_id, name, scheduled_time, active
  ) values (
    (select auth.uid()),
    nullif(p_group->>'profile_id', '')::uuid,
    p_group->>'name',
    (p_group->>'scheduled_time')::time,
    true
  )
  returning * into v_group;

  insert into medication_group_members (group_id, medication_id, quantity_per_dose, sort_order)
  select v_group.id,
         (elem->>'medication_id')::uuid,
         (elem->>'quantity_per_dose')::numeric,
         coalesce((elem->>'sort_order')::smallint, (ord - 1)::smallint)
    from jsonb_array_elements(p_members) with ordinality as t(elem, ord);

  return v_group;
end;
$$;

grant execute on function create_group(jsonb, jsonb) to authenticated;

create or replace function update_group(
  p_group_id uuid,
  p_group jsonb,
  p_members jsonb default '[]'::jsonb
)
returns void
language plpgsql
as $$
begin
  perform 1 from medication_groups where id = p_group_id for update;

  if not found then
    raise exception 'Group not found';
  end if;

  update medication_groups set
    name = p_group->>'name',
    scheduled_time = (p_group->>'scheduled_time')::time,
    profile_id = nullif(p_group->>'profile_id', '')::uuid,
    updated_at = now()
  where id = p_group_id;

  delete from medication_group_members where group_id = p_group_id;

  insert into medication_group_members (group_id, medication_id, quantity_per_dose, sort_order)
  select p_group_id,
         (elem->>'medication_id')::uuid,
         (elem->>'quantity_per_dose')::numeric,
         coalesce((elem->>'sort_order')::smallint, (ord - 1)::smallint)
    from jsonb_array_elements(p_members) with ordinality as t(elem, ord);
end;
$$;

grant execute on function update_group(uuid, jsonb, jsonb) to authenticated;
