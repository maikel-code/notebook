alter table public.ingestion_jobs
  add column created_at timestamptz not null default now();
