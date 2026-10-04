begin;

alter table public.picture_sets
  add column if not exists cover_image_variants jsonb not null default '{}'::jsonb;

alter table public.pictures
  add column if not exists image_variants jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'picture_sets_cover_image_variants_is_object'
      and conrelid = 'public.picture_sets'::regclass
  ) then
    alter table public.picture_sets
      add constraint picture_sets_cover_image_variants_is_object
      check (jsonb_typeof(cover_image_variants) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pictures_image_variants_is_object'
      and conrelid = 'public.pictures'::regclass
  ) then
    alter table public.pictures
      add constraint pictures_image_variants_is_object
      check (jsonb_typeof(image_variants) = 'object');
  end if;
end $$;

comment on column public.picture_sets.cover_image_variants is
  'Responsive cover image variants keyed by width plus original, for example {"640": "/picture/responsive/.../w640.webp", "1280": "/picture/responsive/.../w1280.webp", "original": "/picture/responsive/.../original.jpg"}.';

comment on column public.pictures.image_variants is
  'Responsive picture image variants keyed by width plus original, for example {"640": "/picture/responsive/.../w640.webp", "1280": "/picture/responsive/.../w1280.webp", "original": "/picture/responsive/.../original.jpg"}.';

commit;
