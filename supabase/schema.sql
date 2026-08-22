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
-- USER PROFILES (owner's own extended profile info)
-- One row per auth user, created lazily on first save. family_profiles
-- already covers family members' equivalent fields; this is the owner's
-- own counterpart, since auth.users can't be extended with app columns.
-- ─────────────────────────────────────────
create table if not exists user_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  display_name     text,
  first_name       text,
  last_name        text,
  birth_date       date,
  height_value     numeric(5,2),
  height_unit      text,
  profile_picture  text,
  updated_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEDICATIONS
-- ─────────────────────────────────────────
create table if not exists medications (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  -- cascade, not set null: profile_id null means "the account owner" in
  -- the app, so removing a family member must remove their medications
  -- (and everything that cascades from a medication row) rather than
  -- silently reassigning them to the owner.
  profile_id              uuid references family_profiles(id) on delete cascade,
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
  profile_id     uuid references family_profiles(id) on delete cascade,
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
  profile_id     uuid references family_profiles(id) on delete cascade,
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
  profile_id    uuid references family_profiles(id) on delete cascade,
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

-- `unique (owner_user_id, profile_id, allergy_catalog_id)` above has the
-- same gap as allergy_catalog_global_name_uidx above it: Postgres treats
-- every NULL profile_id as distinct, so the composite constraint never
-- fires for the owner's own allergies (profile_id IS NULL) — only for
-- family members'. A partial unique index on just the owner-level rows
-- closes that gap the same way.
create unique index if not exists profile_allergies_owner_catalog_uidx
  on profile_allergies (owner_user_id, allergy_catalog_id) where profile_id is null;

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
-- AVATARS STORAGE BUCKET (step 8 — Profile & Family)
-- Public bucket so getPublicUrl() works directly for <img> tags. Both the
-- owner's own picture and every family member's picture upload under the
-- owner's own uid folder ({userId}/{randomId}.{ext}), since family
-- profiles have no independent storage identity of their own.
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table user_profiles              enable row level security;
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
-- auth.uid() is wrapped in (select ...) throughout: unwrapped, Postgres
-- re-evaluates it once per row instead of once per query, which is a
-- documented RLS performance pitfall at any real row count.
create policy "own medications"
  on medications for all using ((select auth.uid()) = user_id);
create policy "own schedule times"
  on medication_schedule_times for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own dose logs"
  on dose_logs for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own postpones"
  on dose_postpones for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own refills"
  on medication_refills for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own inventory transactions"
  on inventory_transactions for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own side effects"
  on side_effects for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own dose changes"
  on medication_dose_changes for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own status events"
  on medication_status_events for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own groups"
  on medication_groups for all using ((select auth.uid()) = user_id);
create policy "own group members"
  on medication_group_members for all
  using (group_id in (select id from medication_groups where user_id = (select auth.uid())));
create policy "own notes"
  on medication_notes for all
  using (medication_id in (select id from medications where user_id = (select auth.uid())));
create policy "own drafts"
  on medication_drafts for all using ((select auth.uid()) = user_id);
create policy "own pain mood logs"
  on standalone_pain_mood_logs for all using ((select auth.uid()) = user_id);
create policy "own mood tags"
  on mood_tags for all using ((select auth.uid()) = user_id);
create policy "read allergy catalog"
  on allergy_catalog for select using (owner_user_id is null or owner_user_id = (select auth.uid()));
-- Split into the three write actions (not "for all", which would
-- duplicate "read allergy catalog"'s SELECT coverage and force both
-- permissive policies to run on every read) — Postgres policies can't
-- list multiple commands in one FOR clause, so this is three policies.
create policy "manage own allergy catalog entries insert"
  on allergy_catalog for insert
  with check (owner_user_id = (select auth.uid()));
create policy "manage own allergy catalog entries update"
  on allergy_catalog for update
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy "manage own allergy catalog entries delete"
  on allergy_catalog for delete
  using (owner_user_id = (select auth.uid()));
create policy "own profile allergies"
  on profile_allergies for all using ((select auth.uid()) = owner_user_id);
create policy "own settings"
  on app_settings for all using ((select auth.uid()) = user_id);
create policy "own push subscriptions"
  on push_subscriptions for all using ((select auth.uid()) = user_id);
create policy "own notifications"
  on user_notifications for all using ((select auth.uid()) = user_id);
create policy "own family profiles"
  on family_profiles for all using ((select auth.uid()) = user_id);
create policy "own onboarding"
  on profile_onboarding for all using ((select auth.uid()) = user_id);
create policy "own user profile"
  on user_profiles for all using ((select auth.uid()) = user_id);

-- Avatars storage bucket policies (step 8) — public read, writes scoped
-- to the caller's own uid folder within the bucket.
create policy "public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy "manage own avatar files insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "manage own avatar files update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "manage own avatar files delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ─────────────────────────────────────────
-- INDEXES
-- Covering indexes for every foreign key — without these, RLS policies
-- and joins that filter through them (which is most of this app's
-- query patterns) fall back to sequential scans as tables grow.
-- ─────────────────────────────────────────
create index if not exists idx_allergy_catalog_owner_user_id on allergy_catalog(owner_user_id);
create index if not exists idx_family_profiles_user_id on family_profiles(user_id);
create index if not exists idx_inventory_transactions_dose_log_id on inventory_transactions(dose_log_id);
create index if not exists idx_inventory_transactions_medication_id on inventory_transactions(medication_id);
create index if not exists idx_inventory_transactions_refill_id on inventory_transactions(refill_id);
create index if not exists idx_medication_dose_changes_medication_id on medication_dose_changes(medication_id);
create index if not exists idx_medication_drafts_profile_id on medication_drafts(profile_id);
create index if not exists idx_medication_drafts_user_id on medication_drafts(user_id);
create index if not exists idx_medication_group_members_medication_id on medication_group_members(medication_id);
create index if not exists idx_medication_groups_profile_id on medication_groups(profile_id);
create index if not exists idx_medication_groups_user_id on medication_groups(user_id);
create index if not exists idx_medication_notes_medication_id on medication_notes(medication_id);
create index if not exists idx_medication_refills_medication_id on medication_refills(medication_id);
create index if not exists idx_medication_status_events_medication_id on medication_status_events(medication_id);
create index if not exists idx_medications_profile_id on medications(profile_id);
create index if not exists idx_medications_user_id on medications(user_id);
create index if not exists idx_profile_allergies_allergy_catalog_id on profile_allergies(allergy_catalog_id);
create index if not exists idx_profile_allergies_profile_id on profile_allergies(profile_id);
create index if not exists idx_profile_onboarding_profile_id on profile_onboarding(profile_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);
create index if not exists idx_side_effects_medication_id on side_effects(medication_id);
create index if not exists idx_standalone_pain_mood_logs_medication_id on standalone_pain_mood_logs(medication_id);
create index if not exists idx_standalone_pain_mood_logs_profile_id on standalone_pain_mood_logs(profile_id);
create index if not exists idx_standalone_pain_mood_logs_user_id on standalone_pain_mood_logs(user_id);
create index if not exists idx_user_notifications_medication_id on user_notifications(medication_id);
create index if not exists idx_user_notifications_user_id on user_notifications(user_id);

-- ─────────────────────────────────────────
-- DOSE RECORDING RPC
-- Take/Skip run through this single RPC rather than a client-side
-- read-then-write, so two concurrent calls for the same slot
-- (double-click, two tabs/devices) can't both observe "no existing
-- log" and both deduct inventory for what should be a single dose.
-- The `for update` lock on the medication row serializes concurrent
-- calls for that medication; security invoker (the default) means it
-- runs with the calling user's own privileges, so the "own
-- medications"/"own dose logs" RLS policies still apply inside it.
-- p_pain_level/p_mood_level/p_note capture Take-time feedback for
-- medications with feedback tracking enabled (step 6); like
-- deducted_quantity, they only apply when p_status = 'taken' and reset
-- to null/'' otherwise, since feedback describes how the dose actually
-- taken felt, not a skipped one.
-- ─────────────────────────────────────────
create or replace function record_dose(
  p_medication_id uuid,
  p_scheduled_for_date date,
  p_scheduled_time time,
  p_status text,
  p_quantity_per_dose numeric,
  p_inventory_enabled boolean,
  p_pain_level smallint default null,
  p_mood_level smallint default null,
  p_note text default null
)
returns void
language plpgsql
as $$
declare
  v_existing_status text;
  v_existing_deducted numeric;
begin
  perform 1 from medications where id = p_medication_id for update;

  select status, deducted_quantity
    into v_existing_status, v_existing_deducted
    from dose_logs
   where medication_id = p_medication_id
     and scheduled_for_date = p_scheduled_for_date
     and scheduled_time = p_scheduled_time
   for update;

  if v_existing_status = p_status then
    return; -- already in this state
  end if;

  insert into dose_logs (
    medication_id, scheduled_for_date, scheduled_time, status,
    deducted_quantity, taken_at, pain_level, mood_level, note
  )
  values (
    p_medication_id, p_scheduled_for_date, p_scheduled_time, p_status,
    case when p_status = 'taken' then p_quantity_per_dose else null end,
    case when p_status = 'taken' then now() else null end,
    case when p_status = 'taken' then p_pain_level else null end,
    case when p_status = 'taken' then p_mood_level else null end,
    case when p_status = 'taken' then coalesce(p_note, '') else '' end
  )
  on conflict (medication_id, scheduled_for_date, scheduled_time)
  do update set
    status = excluded.status,
    deducted_quantity = excluded.deducted_quantity,
    taken_at = excluded.taken_at,
    pain_level = excluded.pain_level,
    mood_level = excluded.mood_level,
    note = excluded.note;

  if not p_inventory_enabled then
    return;
  end if;

  if v_existing_status = 'taken' and v_existing_deducted is not null then
    update medications
      set current_quantity = coalesce(current_quantity, 0) + v_existing_deducted,
          updated_at = now()
      where id = p_medication_id;
  end if;

  if p_status = 'taken' then
    update medications
      set current_quantity = coalesce(current_quantity, 0) - p_quantity_per_dose,
          updated_at = now()
      where id = p_medication_id;
  end if;
end;
$$;

grant execute on function record_dose(uuid, date, time, text, numeric, boolean, smallint, smallint, text) to authenticated;

-- ─────────────────────────────────────────
-- DOSE LOG EDIT/DELETE RPCs (step 7 — History)
-- Same atomic, security-invoker, row-locked shape as record_dose, but
-- keyed by an existing dose_logs row's id rather than the medication's
-- natural (medication_id, date, time) key, since these operate on a
-- log that's already been created (via record_dose or backfill) rather
-- than creating/upserting one.
-- ─────────────────────────────────────────
create or replace function delete_dose_log(p_log_id uuid)
returns void
language plpgsql
as $$
declare
  v_medication_id uuid;
  v_status text;
  v_deducted numeric;
  v_inventory_enabled boolean;
begin
  select dl.medication_id, dl.status, dl.deducted_quantity, m.inventory_enabled
    into v_medication_id, v_status, v_deducted, v_inventory_enabled
    from dose_logs dl
    join medications m on m.id = dl.medication_id
   where dl.id = p_log_id
   for update;

  if v_medication_id is null then
    raise exception 'Dose log not found';
  end if;

  perform 1 from medications where id = v_medication_id for update;

  delete from dose_logs where id = p_log_id;

  if v_status = 'taken' and v_deducted is not null and v_inventory_enabled then
    update medications
      set current_quantity = coalesce(current_quantity, 0) + v_deducted,
          updated_at = now()
      where id = v_medication_id;
  end if;
end;
$$;

grant execute on function delete_dose_log(uuid) to authenticated;

-- p_taken_at/p_pain_level/p_mood_level/p_note/p_quantity_per_dose only
-- apply when p_status = 'taken' (mirrors record_dose); always sets
-- feedback_edited_at, since every call here is by definition an edit of
-- an existing entry, unlike record_dose's initial Take-time capture.
create or replace function edit_dose_log(
  p_log_id uuid,
  p_status text,
  p_taken_at timestamptz,
  p_pain_level smallint default null,
  p_mood_level smallint default null,
  p_note text default null,
  p_quantity_per_dose numeric default null,
  p_inventory_enabled boolean default false
)
returns void
language plpgsql
as $$
declare
  v_medication_id uuid;
  v_old_status text;
  v_old_deducted numeric;
begin
  select medication_id, status, deducted_quantity
    into v_medication_id, v_old_status, v_old_deducted
    from dose_logs
   where id = p_log_id
   for update;

  if v_medication_id is null then
    raise exception 'Dose log not found';
  end if;

  perform 1 from medications where id = v_medication_id for update;

  update dose_logs
    set status = p_status,
        taken_at = case when p_status = 'taken' then coalesce(p_taken_at, now()) else null end,
        deducted_quantity = case when p_status = 'taken' then p_quantity_per_dose else null end,
        pain_level = case when p_status = 'taken' then p_pain_level else null end,
        mood_level = case when p_status = 'taken' then p_mood_level else null end,
        note = case when p_status = 'taken' then coalesce(p_note, '') else '' end,
        feedback_edited_at = now()
   where id = p_log_id;

  if not p_inventory_enabled then
    return;
  end if;

  if v_old_status = 'taken' and v_old_deducted is not null then
    update medications
      set current_quantity = coalesce(current_quantity, 0) + v_old_deducted,
          updated_at = now()
      where id = v_medication_id;
  end if;

  if p_status = 'taken' then
    update medications
      set current_quantity = coalesce(current_quantity, 0) - p_quantity_per_dose,
          updated_at = now()
      where id = v_medication_id;
  end if;
end;
$$;

grant execute on function edit_dose_log(uuid, text, timestamptz, smallint, smallint, text, numeric, boolean) to authenticated;
