create table if not exists public.leads (
  id bigserial primary key,
  ts timestamptz not null default now(),
  email text not null,
  source text,
  page text,
  ua text
);

create index if not exists leads_ts_idx on public.leads (ts desc);
create index if not exists leads_email_idx on public.leads (email);

create table if not exists public.events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  name text not null,
  page text,
  meta jsonb not null default '{}'::jsonb,
  ua text
);

create index if not exists events_ts_idx on public.events (ts desc);
create index if not exists events_name_idx on public.events (name);

create table if not exists public.poem_collections (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poem_collections_created_at_idx on public.poem_collections (created_at desc);

create table if not exists public.poems (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.poem_collections(id) on delete cascade,
  collection_token text not null,
  title text,
  text text not null,
  status text not null default 'final' check (status in ('draft','final')),
  text_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists poems_collection_text_hash_uidx on public.poems (collection_id, text_hash);
create index if not exists poems_collection_id_idx on public.poems (collection_id);
create index if not exists poems_collection_token_idx on public.poems (collection_token);
create index if not exists poems_created_at_idx on public.poems (created_at desc);
