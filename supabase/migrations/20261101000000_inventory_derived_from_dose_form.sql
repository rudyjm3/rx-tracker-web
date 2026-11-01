-- Inventory type/unit are no longer entered separately in the add-medication
-- wizard; they follow the medication's dose_form (picked in the Medication
-- step). Columns keep their names (inventory_type / inventory_unit) because
-- the RPCs and every reader depend on them, but they are now derived.
--
-- Backfill existing rows so the stored wording matches dose_form. Rows with
-- no dose_form, or one we have no wording for, are left untouched.

update public.medications m
set inventory_type = w.inv_type,
    inventory_unit = w.inv_unit
from (values
  ('tablet',    'pills',      'tablets'),
  ('capsule',   'pills',      'capsules'),
  ('liquid',    'liquid',     'mL'),
  ('inhaler',   'inhaler',    'puffs'),
  ('injection', 'injections', 'doses'),
  ('patch',     'patches',    'patches'),
  ('drops',     'drops',      'drops'),
  ('other',     'supply',     'units')
) as w(form, inv_type, inv_unit)
where lower(trim(m.dose_form)) = w.form
  and (m.inventory_type is distinct from w.inv_type
       or m.inventory_unit is distinct from w.inv_unit);

comment on column public.medications.inventory_type is
  'Derived from dose_form by the clients (what is being counted, e.g. pills). Not user-entered.';
comment on column public.medications.inventory_unit is
  'Derived from dose_form by the clients (countable unit, e.g. tablets, capsules, mL). Not user-entered.';
