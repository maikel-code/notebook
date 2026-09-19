alter table public.notebooks enable row level security;
alter table public.sources enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.chunks enable row level security;
alter table public.messages enable row level security;
alter table public.citations enable row level security;

revoke all on table public.notebooks from anon, authenticated;
revoke all on table public.sources from anon, authenticated;
revoke all on table public.ingestion_jobs from anon, authenticated;
revoke all on table public.chunks from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.citations from anon, authenticated;

grant all on table public.notebooks to service_role;
grant all on table public.sources to service_role;
grant all on table public.ingestion_jobs to service_role;
grant all on table public.chunks to service_role;
grant all on table public.messages to service_role;
grant all on table public.citations to service_role;
