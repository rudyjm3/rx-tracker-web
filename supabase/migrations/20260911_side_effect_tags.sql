-- ─────────────────────────────────────────
-- SIDE EFFECT TAGS
-- Reference list of common side effects for the side-effect-logging
-- picker, mirroring mood_tags. Seeded lazily on first read (client-side).
-- ─────────────────────────────────────────
create table if not exists side_effect_tags (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  always_show boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now(),
  unique (user_id, name)
);

alter table side_effect_tags enable row level security;

create policy "own side effect tags"
  on side_effect_tags for all using ((select auth.uid()) = user_id);
