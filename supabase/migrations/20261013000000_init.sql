-- VibeCheck · esquema inicial
-- Tabla de análisis de proyectos + función pública para leer informes publicados.

create extension if not exists pgcrypto;

create table if not exists public.analyses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_name  text not null,
  student_name  text,
  course        text,
  url           text,
  mode          text not null default 'auto' check (mode in ('auto', 'manual')),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  share_slug    text not null unique default encode(gen_random_bytes(6), 'hex'),
  auto_results  jsonb,
  evaluations   jsonb not null default '{}'::jsonb,
  strengths     text,
  improvements  text,
  general_notes text,
  private_notes text,
  score         numeric(5, 2),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists analyses_owner_idx on public.analyses (owner_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists analyses_touch on public.analyses;
create trigger analyses_touch
  before update on public.analyses
  for each row execute function public.touch_updated_at();

-- RLS: cada docente solo ve y edita sus propios análisis.
alter table public.analyses enable row level security;

drop policy if exists "owner select" on public.analyses;
create policy "owner select" on public.analyses
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "owner insert" on public.analyses;
create policy "owner insert" on public.analyses
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "owner update" on public.analyses;
create policy "owner update" on public.analyses
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owner delete" on public.analyses;
create policy "owner delete" on public.analyses
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Informe público: solo por slug, solo publicados y sin notas privadas.
-- Así nadie puede listar todos los informes ni leer private_notes.
create or replace function public.get_public_report(p_slug text)
returns table (
  project_name  text,
  student_name  text,
  course        text,
  url           text,
  mode          text,
  share_slug    text,
  auto_results  jsonb,
  evaluations   jsonb,
  strengths     text,
  improvements  text,
  general_notes text,
  score         numeric,
  published_at  timestamptz,
  updated_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.project_name, a.student_name, a.course, a.url, a.mode, a.share_slug,
         a.auto_results, a.evaluations, a.strengths, a.improvements, a.general_notes,
         a.score, a.published_at, a.updated_at
  from public.analyses a
  where a.share_slug = p_slug and a.status = 'published'
  limit 1;
$$;

revoke all on function public.get_public_report(text) from public;
grant execute on function public.get_public_report(text) to anon, authenticated;
