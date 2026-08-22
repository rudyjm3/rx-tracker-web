-- RxTracker schema for Supabase (Postgres)
-- Run this in the Supabase dashboard's SQL Editor (Project → SQL Editor → New query)
-- before using auth/data features of the app. Supabase Auth manages its own
-- auth.users table separately — this schema only adds the app's own tables.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- FAMILY PROFILES
-- ─────────────────────────────────────────
create table if not exists family_profiles (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  display_name     text not null,
  first_name       text,
  last_name        text,
  avatar_color     text,
  relationship     text,
  birth_year       int,
  birth_date       date,
  height_value     numeric(5,2),
  height_unit      text,
  profile_picture  text,
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATIONS
-- ─────────────────────────────────────────
create table if not exists medications (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  profile_id              uuid references family_profiles(id) on delete set null,
  name                    text not null,
  dose                    text not null default '',
  dose_amount             numeric(10,3),
  dose_unit               text,
  dose_form               text,
  instructions            text not null default '',
  schedule_mode           text not null default 'fixed_times'
                            check (schedule_mode in ('fixed_times','interval')),
  interval_hours          smallint,
  first_dose_time         time,
  as_needed               boolean not null default false,
  medication_type         text not null default 'prescription'
                            check (medication_type in ('prescription','otc','supplement')),
  inventory_type          text not null default 'pills',
  inventory_unit          text not null default 'tablets',
  starting_quantity       numeric(10,3),
  current_quantity        numeric(10,3),
  quantity_per_dose       numeric(10,3) not null default 1,
  low_supply_threshold    int not null default 5,
  track_dose_feedback     boolean not null default false,
  feedback_type           text not null default 'none'
                            check (feedback_type in ('none','pain','mood','both')),
  start_date              date,
  end_date                date,
  active                  boolean not null default true,
  setup_status            text not null default 'active'
                            check (setup_status in ('draft','ready','active')),
  dashboard_enabled       boolean not null default true,
  reminders_enabled       boolean not null default true,
  adherence_enabled       boolean not null default true,
  inventory_enabled       boolean not null default false,
  sort_order              smallint not null default 0,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATION SCHEDULE TIMES
-- ─────────────────────────────────────────
create table if not exists medication_schedule_times (
  id                uuid primary key default uuid_generate_v4(),
  medication_id     uuid not null references medications(id) on delete cascade,
  reminder_time     time not null,
  quantity_per_dose numeric(10,3),
  created_at        timestamptz default now(),
  unique (medication_id, reminder_time)
);

-- ─────────────────────────────────────────
-- DOSE LOGS
-- ─────────────────────────────────────────
create table if not exists dose_logs (
  id                  uuid primary key default uuid_generate_v4(),
  medication_id       uuid not null references medications(id) on delete cascade,
  scheduled_for_date  date not null,
  scheduled_time      time not null,
  status              text not null default 'taken'
                        check (status in ('taken','skipped','missed')),
  note                text not null default '',
  pain_level          smallint check (pain_level between 1 and 10),
  mood_level          smallint check (mood_level between 1 and 10),
  deducted_quantity   numeric(10,3),
  taken_at            timestamptz default now(),
  feedback_edited_at  timestamptz,
  created_at          timestamptz default now(),
  unique (medication_id, scheduled_for_date, scheduled_time)
);

-- ─────────────────────────────────────────
-- DOSE POSTPONES (snooze)
-- ─────────────────────────────────────────
create table if not exists dose_postpones (
  id                  uuid primary key default uuid_generate_v4(),
  medication_id       uuid not null references medications(id) on delete cascade,
  scheduled_for_date  date not null,
  scheduled_time      time not null,
  postponed_until     timestamptz not null,
  resolved_at         timestamptz,
  created_at          timestamptz default now(),
  unique (medication_id, scheduled_for_date, scheduled_time)
);

-- ─────────────────────────────────────────
-- MEDICATION REFILLS
-- ─────────────────────────────────────────
create table if not exists medication_refills (
  id             uuid primary key default uuid_generate_v4(),
  medication_id  uuid not null references medications(id) on delete cascade,
  refill_date    date not null,
  amount         numeric(10,3) not null,
  pills_on_hand  numeric(10,3) not null,
  note           text not null default '',
  entry_type     text not null default 'refill',
  started_using_at  timestamptz,
  carryover_quantity numeric(10,3) not null default 0,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- INVENTORY TRANSACTIONS (ledger)
-- ─────────────────────────────────────────
create table if not exists inventory_transactions (
  id               uuid primary key default uuid_generate_v4(),
  medication_id    uuid not null references medications(id) on delete cascade,
  dose_log_id      uuid references dose_logs(id),
  refill_id        uuid references medication_refills(id),
  transaction_type text not null,
  quantity_delta   numeric(10,3) not null,
  balance_after    numeric(10,3) not null,
  effective_at     timestamptz not null,
  count_method     text,
  note             text not null default '',
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- SIDE EFFECTS
-- ─────────────────────────────────────────
create table if not exists side_effects (
  id            uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references medications(id) on delete cascade,
  occurred_date date not null,
  description   text not null,
  severity      text not null default 'mild'
                  check (severity in ('mild','moderate','severe')),
  note          text not null default '',
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- DOSE CHANGE HISTORY
-- ─────────────────────────────────────────
create table if not exists medication_dose_changes (
  id              uuid primary key default uuid_generate_v4(),
  medication_id   uuid not null references medications(id) on delete cascade,
  changed_at      timestamptz not null default now(),
  old_dose_amount numeric(10,3),
  old_dose_unit   text not null default '',
  new_dose_amount numeric(10,3),
  new_dose_unit   text not null default '',
  comment         text not null default '',
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATION STATUS EVENTS (discontinue / resume)
-- ─────────────────────────────────────────
create table if not exists medication_status_events (
  id            uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references medications(id) on delete cascade,
  event         text not null,
  event_at      timestamptz not null default now(),
  reason        text not null default '',
  comment       text not null default '',
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATION GROUPS (take-together clusters)
-- ─────────────────────────────────────────
create table if not exists medication_groups (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid references family_profiles(id) on delete set null,
  name           text not null,
  scheduled_time time not null,
  active         boolean not null default true,
  sort_order     smallint not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists medication_group_members (
  group_id          uuid not null references medication_groups(id) on delete cascade,
  medication_id     uuid not null references medications(id) on delete cascade,
  sort_order        smallint not null default 0,
  quantity_per_dose numeric(10,3),
  primary key (group_id, medication_id)
);

-- ─────────────────────────────────────────
-- MEDICATION NOTES
-- ─────────────────────────────────────────
create table if not exists medication_notes (
  id            uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references medications(id) on delete cascade,
  note          text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATION DRAFTS (wizard in-progress saves)
-- ─────────────────────────────────────────
create table if not exists medication_drafts (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid references family_profiles(id) on delete set null,
  form_data      text not null,
  current_step   smallint not null default 1,
  furthest_step  smallint not null default 1,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- STANDALONE PAIN / MOOD LOGS
-- medication_id is nullable — supports independent logs not tied to any medication
-- ─────────────────────────────────────────
create table if not exists standalone_pain_mood_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  medication_id uuid references medications(id) on delete cascade,
  profile_id    uuid references family_profiles(id) on delete set null,
  log_type      text not null check (log_type in ('pain','mood','both')),
  pain_level    smallint check (pain_level between 1 and 10),
  mood_level    smallint check (mood_level between 1 and 10),
  note          text not null default '',
  tags          text not null default '',
  logged_at     timestamptz default now(),
  updated_at    timestamptz
);

-- ─────────────────────────────────────────
-- MOOD TAGS
-- ─────────────────────────────────────────
create table if not exists mood_tags (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  always_show boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now(),
  unique (user_id, name)
);

-- ─────────────────────────────────────────
-- ALLERGY CATALOG + PROFILE ALLERGIES
-- ─────────────────────────────────────────
create table if not exists allergy_catalog (
  id             uuid primary key default uuid_generate_v4(),
  owner_user_id  uuid references auth.users(id) on delete cascade,
  -- NULL = global system allergy visible to all users
  name           text not null,
  created_at     timestamptz default now(),
  unique (name, owner_user_id)
);

-- `unique (name, owner_user_id)` doesn't stop duplicate global rows on
-- re-run: Postgres treats every NULL owner_user_id as distinct, so the
-- composite constraint never fires for them. A partial unique index on
-- just the global rows closes that gap and gives `on conflict` something
-- to target below.
create unique index if not exists allergy_catalog_global_name_uidx
  on allergy_catalog (name) where owner_user_id is null;

-- Seed common system allergies (owner_user_id NULL = global)
insert into allergy_catalog (owner_user_id, name) values
  (null, 'Penicillin'), (null, 'Sulfa Drugs'), (null, 'Aspirin/NSAIDs'),
  (null, 'Codeine/Opioids'), (null, 'Iodine/Contrast Dye'), (null, 'Latex'),
  (null, 'Peanuts'), (null, 'Tree Nuts'), (null, 'Shellfish'),
  (null, 'Eggs'), (null, 'Milk/Dairy'), (null, 'Soy'), (null, 'Wheat/Gluten'),
  (null, 'Pollen'), (null, 'Pet Dander (Cat/Dog)'), (null, 'Bee/Insect Stings')
on conflict (name) where owner_user_id is null do nothing;

create table if not exists profile_allergies (
  id                  uuid primary key default uuid_generate_v4(),
  owner_user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id          uuid references family_profiles(id) on delete cascade,
  allergy_catalog_id  uuid not null references allergy_catalog(id) on delete cascade,
  allergy_type        text not null default 'allergy',
  life_threatening    boolean not null default false,
  severity            text,
  category            text,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz default now(),
  unique (owner_user_id, profile_id, allergy_catalog_id)
);

-- ─────────────────────────────────────────
-- APP SETTINGS (per-user key-value store)
-- ─────────────────────────────────────────
create table if not exists app_settings (
  user_id       uuid not null references auth.users(id) on delete cascade,
  setting_key   text not null,
  setting_value text not null,
  updated_at    timestamptz default now(),
  primary key (user_id, setting_key)
);

-- ─────────────────────────────────────────
-- PUSH SUBSCRIPTIONS (Expo push tokens)
-- ─────────────────────────────────────────
create table if not exists push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  expo_token  text not null unique,
  device_name text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────
-- USER NOTIFICATIONS (in-app low-stock alerts)
-- ─────────────────────────────────────────
create table if not exists user_notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references medications(id) on delete cascade,
  type          text not null
                  check (type in ('low_stock','critical_stock','out_of_stock')),
  is_read       boolean not null default false,
  is_dismissed  boolean not null default false,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- ONBOARDING STATUS
-- ─────────────────────────────────────────
create table if not exists profile_onboarding (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid references family_profiles(id) on delete cascade,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','completed','skipped')),
  current_step text not null default 'medications',
  started_at   timestamptz default now(),
  completed_at timestamptz,
  unique (user_id, profile_id)
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table medications               enable row level security;
alter table medication_schedule_times  enable row level security;
alter table dose_logs                  enable row level security;
alter table dose_postpones             enable row level security;
alter table medication_refills         enable row level security;
alter table inventory_transactions     enable row level security;
alter table side_effects               enable row level security;
alter table medication_dose_changes    enable row level security;
alter table medication_status_events   enable row level security;
alter table medication_groups          enable row level security;
alter table medication_group_members   enable row level security;
alter table medication_notes           enable row level security;
alter table medication_drafts          enable row level security;
alter table standalone_pain_mood_logs  enable row level security;
alter table mood_tags                  enable row level security;
alter table allergy_catalog            enable row level security;
alter table profile_allergies          enable row level security;
alter table app_settings               enable row level security;
alter table push_subscriptions         enable row level security;
alter table user_notifications         enable row level security;
alter table family_profiles            enable row level security;
alter table profile_onboarding         enable row level security;

-- RLS Policies
create policy "own medications"
  on medications for all using (auth.uid() = user_id);
create policy "own schedule times"
  on medication_schedule_times for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own dose logs"
  on dose_logs for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own postpones"
  on dose_postpones for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own refills"
  on medication_refills for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own inventory transactions"
  on inventory_transactions for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own side effects"
  on side_effects for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own dose changes"
  on medication_dose_changes for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own status events"
  on medication_status_events for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own groups"
  on medication_groups for all using (auth.uid() = user_id);
create policy "own group members"
  on medication_group_members for all
  using (group_id in (select id from medication_groups where user_id = auth.uid()));
create policy "own notes"
  on medication_notes for all
  using (medication_id in (select id from medications where user_id = auth.uid()));
create policy "own drafts"
  on medication_drafts for all using (auth.uid() = user_id);
create policy "own pain mood logs"
  on standalone_pain_mood_logs for all using (auth.uid() = user_id);
create policy "own mood tags"
  on mood_tags for all using (auth.uid() = user_id);
create policy "read allergy catalog"
  on allergy_catalog for select using (owner_user_id is null or owner_user_id = auth.uid());
create policy "manage own allergy catalog entries"
  on allergy_catalog for all using (owner_user_id = auth.uid());
create policy "own profile allergies"
  on profile_allergies for all using (auth.uid() = owner_user_id);
create policy "own settings"
  on app_settings for all using (auth.uid() = user_id);
create policy "own push subscriptions"
  on push_subscriptions for all using (auth.uid() = user_id);
create policy "own notifications"
  on user_notifications for all using (auth.uid() = user_id);
create policy "own family profiles"
  on family_profiles for all using (auth.uid() = user_id);
create policy "own onboarding"
  on profile_onboarding for all using (auth.uid() = user_id);
