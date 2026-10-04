-- Baseline RLS for the public portfolio + admin-via-service-role architecture.
--
-- Intent:
-- 1. Browser clients can read only published portfolio data.
-- 2. Browser clients cannot write portfolio data directly.
-- 3. Admin writes go through protected Next.js API routes that use the
--    Supabase service-role key, which bypasses RLS.
--
-- Apply this in the Supabase SQL editor after reviewing table names/columns
-- against your production schema.

begin;

-- Core published content -----------------------------------------------------

alter table public.picture_sets enable row level security;
alter table public.pictures enable row level security;
alter table public.picture_set_translations enable row level security;
alter table public.picture_translations enable row level security;
alter table public.picture_set_locations enable row level security;
alter table public.picture_locations enable row level security;
alter table public.picture_section_assignments enable row level security;
alter table public.picture_set_section_assignments enable row level security;

drop policy if exists "public read published picture sets" on public.picture_sets;
create policy "public read published picture sets"
  on public.picture_sets
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "public read published pictures" on public.pictures;
create policy "public read published pictures"
  on public.pictures
  for select
  to anon, authenticated
  using (
    is_published = true
    and exists (
      select 1
      from public.picture_sets ps
      where ps.id = pictures.picture_set_id
        and ps.is_published = true
    )
  );

drop policy if exists "public read set translations for published sets" on public.picture_set_translations;
create policy "public read set translations for published sets"
  on public.picture_set_translations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.picture_sets ps
      where ps.id = picture_set_translations.picture_set_id
        and ps.is_published = true
    )
  );

drop policy if exists "public read picture translations for published pictures" on public.picture_translations;
create policy "public read picture translations for published pictures"
  on public.picture_translations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.pictures p
      join public.picture_sets ps on ps.id = p.picture_set_id
      where p.id = picture_translations.picture_id
        and p.is_published = true
        and ps.is_published = true
    )
  );

drop policy if exists "public read set locations for published sets" on public.picture_set_locations;
create policy "public read set locations for published sets"
  on public.picture_set_locations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.picture_sets ps
      where ps.id = picture_set_locations.picture_set_id
        and ps.is_published = true
    )
  );

drop policy if exists "public read picture locations for published pictures" on public.picture_locations;
create policy "public read picture locations for published pictures"
  on public.picture_locations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.pictures p
      join public.picture_sets ps on ps.id = p.picture_set_id
      where p.id = picture_locations.picture_id
        and p.is_published = true
        and ps.is_published = true
    )
  );

drop policy if exists "public read section assignments for published sets" on public.picture_set_section_assignments;
create policy "public read section assignments for published sets"
  on public.picture_set_section_assignments
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.picture_sets ps
      where ps.id = picture_set_section_assignments.picture_set_id
        and ps.is_published = true
    )
  );

-- Reference tables used by public pages -------------------------------------

alter table public.sections enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.seasons enable row level security;

drop policy if exists "public read sections" on public.sections;
create policy "public read sections"
  on public.sections
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read public locations only" on public.locations;
create policy "public read public locations only"
  on public.locations
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.picture_set_locations psl
      join public.picture_sets ps on ps.id = psl.picture_set_id
      where psl.location_id = locations.id
        and ps.is_published = true
    )
    or exists (
      select 1
      from public.picture_locations pl
      join public.pictures p on p.id = pl.picture_id
      join public.picture_sets ps on ps.id = p.picture_set_id
      where pl.location_id = locations.id
        and p.is_published = true
        and ps.is_published = true
    )
  );

drop policy if exists "public read categories" on public.categories;
create policy "public read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read seasons" on public.seasons;
create policy "public read seasons"
  on public.seasons
  for select
  to anon, authenticated
  using (true);

-- Internal/admin tables: enable RLS, no browser access by default -----------
-- These tables are used through service-role API routes, so we intentionally
-- do not add anon/authenticated policies here.

alter table public.tags enable row level security;
alter table public.picture_taggings enable row level security;
alter table public.picture_set_taggings enable row level security;
alter table public.picture_categories enable row level security;
alter table public.picture_set_categories enable row level security;
alter table public.people enable row level security;
alter table public.roles enable row level security;
alter table public.picture_participants enable row level security;
alter table public.picture_set_participants enable row level security;

drop policy if exists "no public access to tags" on public.tags;
create policy "no public access to tags"
  on public.tags
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture taggings" on public.picture_taggings;
create policy "no public access to picture taggings"
  on public.picture_taggings
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture set taggings" on public.picture_set_taggings;
create policy "no public access to picture set taggings"
  on public.picture_set_taggings
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture categories" on public.picture_categories;
create policy "no public access to picture categories"
  on public.picture_categories
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture set categories" on public.picture_set_categories;
create policy "no public access to picture set categories"
  on public.picture_set_categories
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to people" on public.people;
create policy "no public access to people"
  on public.people
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to roles" on public.roles;
create policy "no public access to roles"
  on public.roles
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture participants" on public.picture_participants;
create policy "no public access to picture participants"
  on public.picture_participants
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture set participants" on public.picture_set_participants;
create policy "no public access to picture set participants"
  on public.picture_set_participants
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "no public access to picture section assignments" on public.picture_section_assignments;
create policy "no public access to picture section assignments"
  on public.picture_section_assignments
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Existing public views should respect caller permissions instead of the
-- privileges of the role that created them.
alter view public.v_picture_comment_counts set (security_invoker = true);
alter view public.v_picture_set_primary_location set (security_invoker = true);
alter view public.v_picture_like_counts set (security_invoker = true);
alter view public.v_picture_set_comment_counts set (security_invoker = true);
alter view public.v_picture_set_like_counts set (security_invoker = true);
alter view public.v_pictures_markers set (security_invoker = true);
alter view public.v_picture_primary_location set (security_invoker = true);
alter view public.v_picture_sets_markers set (security_invoker = true);

commit;
