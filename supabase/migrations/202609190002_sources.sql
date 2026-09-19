create table public.sources (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_hash text not null,
  byte_size bigint not null,
  page_count integer,
  status text not null default 'uploading',
  error_reason text,
  is_selected boolean not null default true,
  replaces_source_id uuid,
  cleanup_storage_path text,
  created_at timestamptz not null default now(),
  constraint sources_notebook_owner_fk
    foreign key (notebook_id, user_id)
    references public.notebooks(id, user_id)
    on delete cascade,
  constraint sources_file_name_not_empty check (char_length(btrim(file_name)) > 0),
  constraint sources_storage_path_owned check (
    storage_path = user_id::text || '/' || notebook_id::text || '/' || id::text || '.pdf'
  ),
  constraint sources_content_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint sources_byte_size check (byte_size between 1 and 10485760),
  constraint sources_page_count check (page_count is null or page_count between 1 and 50),
  constraint sources_status check (
    status in ('uploading', 'processing', 'ready', 'failed', 'unusable')
  ),
  constraint sources_error_state check (
    (status = 'failed' and error_reason is not null)
    or (status <> 'failed' and error_reason is null)
  ),
  constraint sources_replacement_draft check (
    replaces_source_id is null or (status = 'uploading' and cleanup_storage_path is null)
  ),
  constraint sources_id_user_unique unique (id, user_id),
  constraint sources_id_user_notebook_unique unique (id, user_id, notebook_id),
  constraint sources_replacement_owner_notebook_fk
    foreign key (replaces_source_id, user_id, notebook_id)
    references public.sources(id, user_id, notebook_id)
    on delete set null (replaces_source_id)
);

create index sources_notebook_content_hash_idx
  on public.sources(notebook_id, content_hash);

comment on column public.sources.cleanup_storage_path is
  'Server-only path removed idempotently during the cleanup ingestion phase.';
