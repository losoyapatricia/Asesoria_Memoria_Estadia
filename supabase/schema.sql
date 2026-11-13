-- ============================================================
-- SISTEMAIA · Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Usuarios (auth propia del backend, bcrypt) ----------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text,
  role          text not null default 'student' check (role in ('student', 'admin')),
  created_at    timestamptz not null default now()
);

-- ---------- Documentos ----------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.users(id) on delete cascade,
  title         text not null,
  original_name text not null,
  mime_type     text,
  size_bytes    bigint,
  raw_text      text,                       -- texto extraído para análisis
  status        text not null default 'uploaded'
                check (status in ('uploaded', 'analyzing', 'analyzed', 'error')),
  created_at    timestamptz not null default now()
);

create index if not exists documents_owner_idx on public.documents(owner_id);
create index if not exists documents_created_idx on public.documents(created_at desc);

-- ---------- Análisis ----------
create table if not exists public.analyses (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.documents(id) on delete cascade,
  ai_probability  jsonb not null,           -- {score,label,metrics,issues}
  orthography      jsonb not null,           -- {score,label,errors,totalErrors}
  style           jsonb not null,            -- {score,label,issues,details}
  presentation    jsonb not null,            -- {score,label,issues,details}
  meta            jsonb,                     -- {wordCount,charCount,analyzedAt,...}
  created_at      timestamptz not null default now()
);

create index if not exists analyses_document_idx on public.analyses(document_id);

-- ---------- Row Level Security ----------
-- El backend usa service_role (bypass RLS). Estas políticas protegen el
-- acceso directo desde el cliente de Supabase si se usara en el futuro.
alter table public.users       enable row level security;
alter table public.documents   enable row level security;
alter table public.analyses    enable row level security;

-- Usuarios: cada quien ve/edita solo su fila (el backend no usa esto, pero es buena práctica)
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (auth.uid() = id);

drop policy if exists documents_owner_all on public.documents;
create policy documents_owner_all on public.documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists analyses_via_document on public.analyses;
create policy analyses_via_document on public.analyses
  for all using (
    exists (select 1 from public.documents d
            where d.id = analyses.document_id and d.owner_id = auth.uid())
  );
