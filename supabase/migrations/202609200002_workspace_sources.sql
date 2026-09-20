alter table public.sources
  add column source_kind text not null default 'pdf',
  add column origin_url text,
  add column canonical_url text,
  alter column storage_path drop not null;

alter table public.sources drop constraint sources_storage_path_owned;

alter table public.sources
  add constraint sources_kind check (source_kind in ('pdf', 'web')),
  add constraint sources_shape check (
    (source_kind = 'pdf'
      and storage_path = user_id::text || '/' || notebook_id::text || '/' || id::text || '.pdf'
      and origin_url is null and canonical_url is null)
    or (source_kind = 'web'
      and storage_path is null and page_count = 1
      and origin_url ~ '^https://[^[:space:]]+$'
      and canonical_url ~ '^https://[^[:space:]]+$')
  );

create unique index sources_notebook_canonical_url_unique
  on public.sources(notebook_id, canonical_url) where source_kind = 'web';

alter table public.ingestion_jobs drop constraint ingestion_jobs_phase;
alter table public.ingestion_jobs
  add constraint ingestion_jobs_phase check (
    phase is null or phase in ('cleanup', 'fetch', 'extract', 'chunk', 'embed', 'finalize')
  );

alter table public.messages
  add column message_kind text not null default 'answer',
  add column orientation_source_id uuid,
  add column suggested_questions jsonb;

alter table public.messages drop constraint messages_assistant_shape;
alter table public.messages
  add constraint messages_kind check (message_kind in ('answer', 'source_orientation')),
  add constraint messages_orientation_source_owner_fk
    foreign key (orientation_source_id, user_id)
    references public.sources(id, user_id)
    on delete cascade,
  add constraint messages_user_kind check (role <> 'user' or message_kind = 'answer'),
  add constraint messages_orientation_shape check (
    message_kind <> 'source_orientation' or (
      role = 'assistant' and status = 'complete' and question_message_id is null
      and attempt_no is null and unsupported_reason is null and orientation_source_id is not null
      and suggested_questions is not null and jsonb_typeof(suggested_questions) = 'array'
      and jsonb_array_length(suggested_questions) between 3 and 5
    )
  ),
  add constraint messages_assistant_shape check (
    role <> 'assistant' or (
      (message_kind = 'answer' and question_message_id is not null and attempt_no >= 1
        and selected_sources_snapshot is null and orientation_source_id is null and suggested_questions is null)
      or message_kind = 'source_orientation'
    )
  );

create unique index messages_one_orientation_per_notebook_idx
  on public.messages(notebook_id) where message_kind = 'source_orientation';

create table public.studio_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null,
  title text not null,
  content_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint studio_notes_notebook_owner_fk
    foreign key (notebook_id, user_id)
    references public.notebooks(id, user_id)
    on delete cascade,
  constraint studio_notes_message_owner_notebook_fk
    foreign key (message_id, user_id, notebook_id)
    references public.messages(id, user_id, notebook_id)
    on delete cascade,
  constraint studio_notes_message_unique unique (message_id),
  constraint studio_notes_title_not_empty check (char_length(btrim(title)) between 1 and 200),
  constraint studio_notes_content_not_empty check (char_length(btrim(content_snapshot)) > 0)
);

alter table public.studio_notes enable row level security;
revoke all on table public.studio_notes from anon, authenticated;
grant all on table public.studio_notes to service_role;
