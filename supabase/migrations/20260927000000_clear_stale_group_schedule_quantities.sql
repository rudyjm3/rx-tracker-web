-- Group-owned medication_schedule_times rows (group_id is not null) carried a
-- quantity_per_dose copied at group-join time that went stale after dose
-- changes (e.g. 1 -> 0.5 tablet). The group member's override (or the
-- medication's own dose) is the source of truth for these rows, so clear
-- the redundant copy.
update medication_schedule_times
   set quantity_per_dose = null
 where group_id is not null
   and quantity_per_dose is not null;
