-- ─────────────────────────────────────────
-- LOW-SUPPLY REMINDER DISMISSALS
-- Dismissing a low-supply reminder (dashboard banner or notification
-- bell) hides it for the rest of that local calendar day, account-wide:
-- the row is keyed on the medication, not the device, so dismissing on
-- one device hides it on every other device too. There is deliberately
-- no expiry job — the apps only read rows whose dismissed_date is
-- today's local date, so a still-low medication reappears by itself the
-- next day.
-- ─────────────────────────────────────────
create table if not exists low_supply_dismissals (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id  uuid not null references medications(id) on delete cascade,
  dismissed_date date not null,
  created_at     timestamptz not null default now(),
  unique (medication_id, dismissed_date)
);

alter table low_supply_dismissals enable row level security;

create policy "own low supply dismissals"
  on low_supply_dismissals for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and medication_id in (select id from medications where user_id = (select auth.uid()))
  );

create index if not exists idx_low_supply_dismissals_user_date
  on low_supply_dismissals(user_id, dismissed_date);
