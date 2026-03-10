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
