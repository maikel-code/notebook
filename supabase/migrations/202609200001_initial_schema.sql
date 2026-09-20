create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create table public.notebooks (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebooks_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint notebooks_id_user_unique unique (id, user_id)
);

comment on table public.notebooks is 'Private notebook workspaces owned by one auth user.';

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

create index sources_notebook_content_hash_idx on public.sources(notebook_id, content_hash);
create unique index sources_one_replacement_draft_per_source_idx
  on public.sources(replaces_source_id) where replaces_source_id is not null;

comment on column public.sources.cleanup_storage_path is
  'Server-only path removed idempotently during the cleanup ingestion phase.';

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
  created_at timestamptz not null default now(),
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

create table public.chunks (
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null,
  page_start integer not null,
  page_end integer not null,
  content text not null,
  char_count integer not null,
  embedding extensions.vector(1536) not null,
  constraint chunks_source_owner_fk
    foreign key (source_id, user_id)
    references public.sources(id, user_id)
    on delete cascade,
  constraint chunks_ordinal_positive check (ordinal >= 0),
  constraint chunks_page_range check (page_start >= 1 and page_end >= page_start),
  constraint chunks_content_not_empty check (char_length(content) > 0),
  constraint chunks_char_count_matches check (char_count = char_length(content)),
  constraint chunks_id_user_unique unique (id, user_id),
  constraint chunks_source_ordinal_unique unique (source_id, ordinal)
);

create index chunks_embedding_hnsw_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  status text not null,
  unsupported_reason text,
  selected_sources_snapshot jsonb,
  question_message_id uuid,
  attempt_no integer,
  created_at timestamptz not null default now(),
  constraint messages_notebook_owner_fk
    foreign key (notebook_id, user_id)
    references public.notebooks(id, user_id)
    on delete cascade,
  constraint messages_role check (role in ('user', 'assistant')),
  constraint messages_status check (
    status in ('streaming', 'complete', 'invalid', 'aborted', 'failed')
  ),
  constraint messages_unsupported_reason check (
    unsupported_reason is null or unsupported_reason in (
      'no_selection', 'no_ready_source', 'below_similarity_threshold', 'invalid_citations', 'unsupported'
    )
  ),
  constraint messages_user_shape check (
    role <> 'user' or (
      status = 'complete' and question_message_id is null and attempt_no is null
      and unsupported_reason is null and selected_sources_snapshot is not null
      and jsonb_typeof(selected_sources_snapshot) = 'array'
      and char_length(content) between 1 and 2000
    )
  ),
  constraint messages_assistant_shape check (
    role <> 'assistant' or (
      question_message_id is not null and attempt_no >= 1 and selected_sources_snapshot is null
    )
  ),
  constraint messages_id_user_unique unique (id, user_id),
  constraint messages_id_user_notebook_unique unique (id, user_id, notebook_id),
  constraint messages_question_owner_notebook_fk
    foreign key (question_message_id, user_id, notebook_id)
    references public.messages(id, user_id, notebook_id)
    on delete cascade,
  constraint messages_question_attempt_unique unique (question_message_id, attempt_no)
);

create unique index messages_one_streaming_assistant_per_notebook_idx
  on public.messages(notebook_id) where role = 'assistant' and status = 'streaming';

create table public.citations (
  id uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_id uuid,
  source_id uuid,
  source_name text not null,
  quote text not null,
  page_start integer not null,
  page_end integer not null,
  ordinal integer not null,
  constraint citations_message_owner_fk
    foreign key (message_id, user_id)
    references public.messages(id, user_id)
    on delete cascade,
  constraint citations_chunk_owner_fk
    foreign key (chunk_id, user_id)
    references public.chunks(id, user_id)
    on delete set null (chunk_id),
  constraint citations_source_owner_fk
    foreign key (source_id, user_id)
    references public.sources(id, user_id)
    on delete set null (source_id),
  constraint citations_source_name_not_empty check (char_length(btrim(source_name)) > 0),
  constraint citations_quote_not_empty check (char_length(btrim(quote)) > 0),
  constraint citations_page_range check (page_start >= 1 and page_end >= page_start),
  constraint citations_ordinal_positive check (ordinal >= 0),
  constraint citations_message_ordinal_unique unique (message_id, ordinal)
);

create function public.enforce_citation_reference_consistency()
returns trigger language plpgsql set search_path = '' as $$
declare
  current_chunk_id uuid;
  current_source_id uuid;
  current_user_id uuid;
  chunk_source_id uuid;
begin
  select chunk_id, source_id, user_id into current_chunk_id, current_source_id, current_user_id
  from public.citations where id = new.id;
  if not found then return new; end if;
  if current_source_id is null and current_chunk_id is not null then
    raise exception 'a cited chunk requires its source reference';
  end if;
  if current_chunk_id is not null then
    select source_id into chunk_source_id from public.chunks
    where id = current_chunk_id and user_id = current_user_id;
    if chunk_source_id is null then raise exception 'citation chunk does not belong to owner'; end if;
    if current_source_id <> chunk_source_id then raise exception 'citation source does not match chunk'; end if;
  end if;
  return new;
end;
$$;

create constraint trigger citations_reference_consistency
after insert or update of chunk_id, source_id, user_id on public.citations
deferrable initially deferred for each row
execute function public.enforce_citation_reference_consistency();

alter table public.notebooks enable row level security;
alter table public.sources enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.chunks enable row level security;
alter table public.messages enable row level security;
alter table public.citations enable row level security;

revoke all on table public.notebooks, public.sources, public.ingestion_jobs,
  public.chunks, public.messages, public.citations from anon, authenticated;
grant all on table public.notebooks, public.sources, public.ingestion_jobs,
  public.chunks, public.messages, public.citations to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "owners insert source files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);
create policy "owners read source files" on storage.objects for select to authenticated
using (
  bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
);

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

create function public.confirm_source_upload(p_source_id uuid, p_user_id uuid)
returns void language plpgsql set search_path = '' as $$
declare
  draft public.sources;
  replaced public.sources;
begin
  select * into draft from public.sources where id = p_source_id and user_id = p_user_id for update;
  if not found then raise exception 'source not found'; end if;
  if draft.status = 'processing' then return; end if;
  if draft.status <> 'uploading' then raise exception 'source is not an upload draft'; end if;
  perform 1 from public.messages
  where notebook_id = draft.notebook_id and user_id = p_user_id and role = 'assistant' and status = 'streaming'
  for update;
  if found then raise exception using errcode = 'P0001', message = 'notebook has a streaming response'; end if;
  if draft.replaces_source_id is not null then
    select * into replaced from public.sources
    where id = draft.replaces_source_id and user_id = p_user_id and notebook_id = draft.notebook_id for update;
    if not found then raise exception 'replacement source not found'; end if;
    update public.sources set cleanup_storage_path = replaced.storage_path, replaces_source_id = null
    where id = draft.id and user_id = p_user_id;
    delete from public.sources where id = replaced.id and user_id = p_user_id;
  end if;
  update public.sources set status = 'processing', error_reason = null where id = draft.id and user_id = p_user_id;
  insert into public.ingestion_jobs (source_id, user_id, status, attempt)
  select draft.id, p_user_id, 'queued', 0
  where not exists (select 1 from public.ingestion_jobs where source_id = draft.id and user_id = p_user_id);
end;
$$;

create function public.retry_source_ingestion(p_source_id uuid, p_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  update public.sources set status = 'processing', error_reason = null
  where id = p_source_id and user_id = p_user_id and status = 'failed';
  if not found then raise exception 'failed source not found'; end if;
  insert into public.ingestion_jobs (source_id, user_id, status, attempt)
  values (p_source_id, p_user_id, 'queued', 0);
end;
$$;

create function public.claim_next_ingestion_job(p_source_id uuid default null)
returns table (id uuid, source_id uuid, user_id uuid, attempt integer, correlation_id uuid)
language plpgsql set search_path = '' as $$
declare claimed public.ingestion_jobs;
begin
  select j.* into claimed from public.ingestion_jobs j
  where j.status = 'queued' and (p_source_id is null or j.source_id = p_source_id)
  order by j.id for update skip locked limit 1;
  if not found then return; end if;
  update public.ingestion_jobs set status = 'running', locked_at = now(), started_at = coalesce(started_at, now())
  where ingestion_jobs.id = claimed.id;
  return query select claimed.id, claimed.source_id, claimed.user_id, claimed.attempt, claimed.correlation_id;
end;
$$;

create function public.replace_source_chunks(p_source_id uuid, p_user_id uuid, p_chunks jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  perform 1 from public.sources where id = p_source_id and user_id = p_user_id for update;
  if not found then raise exception 'source not found'; end if;
  delete from public.chunks where source_id = p_source_id and user_id = p_user_id;
  insert into public.chunks (source_id, user_id, ordinal, page_start, page_end, content, char_count, embedding)
  select p_source_id, p_user_id, (entry ->> 'ordinal')::integer, (entry ->> 'page_start')::integer,
    (entry ->> 'page_end')::integer, entry ->> 'content', (entry ->> 'char_count')::integer,
    ((entry -> 'embedding')::text)::extensions.vector
  from jsonb_array_elements(p_chunks) as entry;
end;
$$;

create function public.sweep_stale_ingestion_jobs()
returns integer language plpgsql set search_path = '' as $$
declare affected integer := 0;
begin
  with stale as (
    select id, source_id, user_id, attempt from public.ingestion_jobs
    where status = 'running' and locked_at < now() - interval '5 minutes' for update skip locked
  ), updated as (
    update public.ingestion_jobs job
    set attempt = stale.attempt + 1,
      status = case when stale.attempt + 1 >= 3 then 'failed' else 'queued' end,
      locked_at = null, finished_at = case when stale.attempt + 1 >= 3 then now() else null end,
      last_error = 'Die PDF-Verarbeitung hat das Zeitlimit überschritten.'
    from stale where job.id = stale.id returning stale.source_id, stale.user_id, job.status
  )
  update public.sources source
  set status = case when updated.status = 'failed' then 'failed' else source.status end,
    error_reason = case when updated.status = 'failed' then 'Die PDF-Verarbeitung hat das Zeitlimit überschritten.' else source.error_reason end
  from updated where source.id = updated.source_id and source.user_id = updated.user_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function public.prepare_source_upload(
  p_source_id uuid, p_user_id uuid, p_notebook_id uuid, p_file_name text,
  p_content_hash text, p_byte_size bigint, p_intent text, p_replace_source_id uuid, p_max_sources integer
)
returns table (decision text, existing_source_id uuid, source_id uuid, storage_path text, reason text)
language plpgsql set search_path = '' as $$
declare duplicate_id uuid; active_source_count integer; replacement_id uuid;
begin
  perform 1 from public.notebooks where id = p_notebook_id and user_id = p_user_id for update;
  if not found then raise exception 'notebook not found'; end if;
  select id into duplicate_id from public.sources
  where notebook_id = p_notebook_id and user_id = p_user_id and content_hash = p_content_hash
  order by created_at limit 1;
  if duplicate_id is not null and p_intent is null then
    return query select 'duplicate', duplicate_id, null::uuid, null::text, null::text; return;
  end if;
  if p_intent = 'replace' then
    if p_replace_source_id is null or p_replace_source_id <> duplicate_id then raise exception 'replacement source not found'; end if;
    replacement_id := duplicate_id;
    if exists (select 1 from public.sources where replaces_source_id = replacement_id
      and user_id = p_user_id and notebook_id = p_notebook_id) then
      return query select 'rejected', null::uuid, null::uuid, null::text, 'Diese Quelle wird bereits ersetzt.'; return;
    end if;
  elsif p_intent is null or p_intent = 'add' then
    select count(*) into active_source_count from public.sources
    where notebook_id = p_notebook_id and user_id = p_user_id and replaces_source_id is null;
    if active_source_count >= p_max_sources then
      return query select 'rejected', null::uuid, null::uuid, null::text, 'Ein Notebook darf höchstens 30 Quellen enthalten.'; return;
    end if;
  else
    raise exception 'invalid upload intent';
  end if;
  insert into public.sources (id, user_id, notebook_id, file_name, storage_path, content_hash, byte_size, status, replaces_source_id)
  values (p_source_id, p_user_id, p_notebook_id, p_file_name,
    p_user_id::text || '/' || p_notebook_id::text || '/' || p_source_id::text || '.pdf',
    p_content_hash, p_byte_size, 'uploading', replacement_id);
  return query select 'ok', null::uuid, p_source_id,
    p_user_id::text || '/' || p_notebook_id::text || '/' || p_source_id::text || '.pdf', null::text;
end;
$$;

create function public.cancel_source_upload(p_source_id uuid, p_user_id uuid)
returns text language plpgsql set search_path = '' as $$
declare draft public.sources;
begin
  select * into draft from public.sources where id = p_source_id and user_id = p_user_id for update;
  if not found then raise exception 'source not found'; end if;
  if draft.status <> 'uploading' then raise exception 'source is not an upload draft'; end if;
  delete from public.sources where id = draft.id and user_id = p_user_id;
  return draft.storage_path;
end;
$$;

create function public.persist_answer(
  p_user_id uuid,
  p_notebook_id uuid,
  p_question_content text,
  p_selected_sources_snapshot jsonb,
  p_answer_content text,
  p_answer_status text,
  p_unsupported_reason text,
  p_citations jsonb,
  p_question_message_id uuid default null,
  p_answer_message_id uuid default null
)
returns table (id uuid, status text, unsupported_reason text)
language plpgsql set search_path = '' as $$
declare question_id uuid; answer_id uuid; answer_attempt integer;
begin
  if p_answer_message_id is not null then
    select messages.id, messages.question_message_id into answer_id, question_id from public.messages
    where messages.id = p_answer_message_id and messages.notebook_id = p_notebook_id
      and messages.user_id = p_user_id and messages.role = 'assistant' and messages.status = 'streaming'
    for update;
    if not found then raise exception 'streaming answer not found'; end if;
    update public.messages set content = p_answer_content, status = p_answer_status,
      unsupported_reason = p_unsupported_reason where messages.id = answer_id;
  elsif p_question_message_id is null then
    insert into public.messages (content, notebook_id, role, selected_sources_snapshot, status, user_id)
    values (p_question_content, p_notebook_id, 'user', p_selected_sources_snapshot, 'complete', p_user_id)
    returning messages.id into question_id;
  else
    select messages.id into question_id from public.messages
    where messages.id = p_question_message_id and messages.notebook_id = p_notebook_id
      and messages.user_id = p_user_id and messages.role = 'user'
    for update;
    if not found then raise exception 'question not found'; end if;
  end if;

  if p_answer_message_id is null then
    select coalesce(max(messages.attempt_no), 0) + 1 into answer_attempt from public.messages
    where messages.question_message_id = question_id and messages.user_id = p_user_id;

    insert into public.messages (
      attempt_no, content, notebook_id, question_message_id, role, status, unsupported_reason, user_id
    ) values (
      answer_attempt, p_answer_content, p_notebook_id, question_id, 'assistant', p_answer_status,
      p_unsupported_reason, p_user_id
    ) returning messages.id into answer_id;
  end if;

  insert into public.citations (
    chunk_id, message_id, ordinal, page_end, page_start, quote, source_id, source_name, user_id
  )
  select (entry ->> 'chunk_id')::uuid, answer_id, (entry ->> 'ordinal')::integer,
    (entry ->> 'page_end')::integer, (entry ->> 'page_start')::integer, entry ->> 'quote',
    (entry ->> 'source_id')::uuid, entry ->> 'source_name', p_user_id
  from jsonb_array_elements(coalesce(p_citations, '[]'::jsonb)) as entry;

  return query select answer_id, p_answer_status, p_unsupported_reason;
end;
$$;

create function public.start_answer_attempt(
  p_user_id uuid,
  p_notebook_id uuid,
  p_question_content text,
  p_selected_sources_snapshot jsonb,
  p_question_message_id uuid default null
)
returns table (answer_id uuid, question_id uuid)
language plpgsql set search_path = '' as $$
declare answer_attempt integer;
begin
  if p_question_message_id is null then
    insert into public.messages (content, notebook_id, role, selected_sources_snapshot, status, user_id)
    values (p_question_content, p_notebook_id, 'user', p_selected_sources_snapshot, 'complete', p_user_id)
    returning messages.id into question_id;
  else
    select messages.id into question_id from public.messages
    where messages.id = p_question_message_id and messages.notebook_id = p_notebook_id
      and messages.user_id = p_user_id and messages.role = 'user'
    for update;
    if not found then raise exception 'question not found'; end if;
  end if;
  select coalesce(max(messages.attempt_no), 0) + 1 into answer_attempt from public.messages
  where messages.question_message_id = question_id and messages.user_id = p_user_id;
  insert into public.messages (
    attempt_no, content, notebook_id, question_message_id, role, status, user_id
  ) values (
    answer_attempt, 'Antwort wird geprüft.', p_notebook_id, question_id, 'assistant', 'streaming', p_user_id
  ) returning messages.id into answer_id;
  return next;
end;
$$;

revoke execute on function public.enforce_citation_reference_consistency() from public, anon, authenticated;
revoke all on function public.confirm_source_upload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.retry_source_ingestion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_next_ingestion_job(uuid) from public, anon, authenticated;
revoke all on function public.replace_source_chunks(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sweep_stale_ingestion_jobs() from public, anon, authenticated;
revoke all on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.cancel_source_upload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.persist_answer(uuid, uuid, text, jsonb, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_answer_attempt(uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.confirm_source_upload(uuid, uuid) to service_role;
grant execute on function public.retry_source_ingestion(uuid, uuid) to service_role;
grant execute on function public.claim_next_ingestion_job(uuid) to service_role;
grant execute on function public.replace_source_chunks(uuid, uuid, jsonb) to service_role;
grant execute on function public.sweep_stale_ingestion_jobs() to service_role;
grant execute on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer) to service_role;
grant execute on function public.cancel_source_upload(uuid, uuid) to service_role;
grant execute on function public.persist_answer(uuid, uuid, text, jsonb, text, text, text, jsonb, uuid, uuid) to service_role;
grant execute on function public.start_answer_attempt(uuid, uuid, text, jsonb, uuid) to service_role;
