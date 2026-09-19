create table public.ingestion_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  phase text,
  attempt integer not null default 0,
  last_error text,
  correlation_id uuid not null default extensions.gen_random_uuid(),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  constraint ingestion_jobs_source_owner_fk
    foreign key (source_id, user_id)
    references public.sources(id, user_id)
    on delete cascade,
  constraint ingestion_jobs_status check (status in ('queued', 'running', 'succeeded', 'failed')),
  constraint ingestion_jobs_phase check (
    phase is null or phase in ('cleanup', 'extract', 'chunk', 'embed', 'finalize')
  ),
  constraint ingestion_jobs_attempt check (attempt between 0 and 3),
  constraint ingestion_jobs_time_order check (
    finished_at is null or started_at is null or finished_at >= started_at
  ),
  constraint ingestion_jobs_id_user_unique unique (id, user_id)
);

comment on table public.ingestion_jobs is
  'Ingestion state machine; running jobs older than five minutes are swept as timed out.';
