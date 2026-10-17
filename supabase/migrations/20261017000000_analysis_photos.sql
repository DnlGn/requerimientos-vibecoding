-- Fotos asociadas a un análisis (en general o a un criterio concreto).
-- Los archivos van al bucket "analysis-photos" en la carpeta <owner_id>/<analysis_id>/.

create table if not exists public.analysis_photos (
  id           uuid primary key default gen_random_uuid(),
  analysis_id  uuid not null references public.analyses (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path         text not null unique,
  criterion_id text,
  caption      text,
  is_private   boolean not null default false,
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);

create index if not exists analysis_photos_analysis_idx on public.analysis_photos (analysis_id, created_at);

alter table public.analysis_photos enable row level security;

drop policy if exists "owner select" on public.analysis_photos;
create policy "owner select" on public.analysis_photos
  for select to authenticated using ((select auth.uid()) = owner_id);

-- Solo se pueden agregar fotos a análisis propios.
drop policy if exists "owner insert" on public.analysis_photos;
create policy "owner insert" on public.analysis_photos
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.owner_id = (select auth.uid()))
  );

drop policy if exists "owner update" on public.analysis_photos;
create policy "owner update" on public.analysis_photos
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owner delete" on public.analysis_photos;
create policy "owner delete" on public.analysis_photos
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Fotos del informe público: solo de informes publicados y nunca las marcadas como privadas.
create or replace function public.get_public_report_photos(p_slug text)
returns table (
  id           uuid,
  path         text,
  criterion_id text,
  caption      text,
  width        int,
  height       int,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.path, p.criterion_id, p.caption, p.width, p.height, p.created_at
  from public.analysis_photos p
  join public.analyses a on a.id = p.analysis_id
  where a.share_slug = p_slug and a.status = 'published' and not p.is_private
  order by p.created_at;
$$;

revoke all on function public.get_public_report_photos(text) from public;
grant execute on function public.get_public_report_photos(text) to anon, authenticated;

-- Bucket público (las rutas llevan UUID aleatorios); 5 MB máx. por archivo, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('analysis-photos', 'analysis-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada docente solo sube y borra dentro de su propia carpeta (<owner_id>/...).
drop policy if exists "analysis photos insert own folder" on storage.objects;
create policy "analysis photos insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'analysis-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "analysis photos delete own folder" on storage.objects;
create policy "analysis photos delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'analysis-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
