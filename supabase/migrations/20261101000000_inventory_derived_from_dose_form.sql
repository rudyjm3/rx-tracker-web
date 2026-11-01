-- Inventory type/unit are no longer entered separately in the add-medication
-- wizard; they follow the medication's dose_form (picked in the Medication
-- step). Columns keep their names (inventory_type / inventory_unit) because
-- the RPCs and every reader depend on them, but they are now derived.
--
-- Backfill existing rows so count-based supplies (tablets/capsules) match
-- dose_form. Only rows already counted in a count unit are touched, so no
-- stored quantity changes meaning. Measured supplies (mL, puffs, drops, ...)
-- and rows with no dose_form or other forms are left exactly as they are.

update public.medications m
set inventory_type = w.inv_type,
    inventory_unit = w.inv_unit
from (values
  ('tablet',  'pills', 'tablets'),
  ('capsule', 'pills', 'capsules')
) as w(form, inv_type, inv_unit)
where lower(trim(m.dose_form)) = w.form
  and lower(trim(m.inventory_unit)) in
      ('tablet', 'tablets', 'pill', 'pills', 'capsule', 'capsules', 'caplet', 'caplets')
  and (m.inventory_type is distinct from w.inv_type
       or m.inventory_unit is distinct from w.inv_unit);

comment on column public.medications.inventory_type is
  'Derived from dose_form by the clients (what is being counted, e.g. pills). Not user-entered.';
comment on column public.medications.inventory_unit is
  'Derived from dose_form by the clients (countable unit, e.g. tablets, capsules, mL). Not user-entered.';
