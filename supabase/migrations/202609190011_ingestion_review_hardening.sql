create or replace function public.confirm_source_upload(p_source_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  draft public.sources;
  replaced public.sources;
begin
  select * into draft
  from public.sources
  where id = p_source_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'source not found';
  end if;
  if draft.status = 'processing' then
    return;
  end if;
  if draft.status <> 'uploading' then
    raise exception 'source is not an upload draft';
  end if;

  perform 1
  from public.messages
  where notebook_id = draft.notebook_id
    and user_id = p_user_id
    and role = 'assistant'
    and status = 'streaming'
  for update;
  if found then
    raise exception using
      errcode = 'P0001',
      message = 'notebook has a streaming response';
  end if;

  if draft.replaces_source_id is not null then
    select * into replaced
    from public.sources
    where id = draft.replaces_source_id
      and user_id = p_user_id
      and notebook_id = draft.notebook_id
    for update;
    if not found then
      raise exception 'replacement source not found';
    end if;

    update public.sources
    set cleanup_storage_path = replaced.storage_path,
        replaces_source_id = null
    where id = draft.id and user_id = p_user_id;
    delete from public.sources where id = replaced.id and user_id = p_user_id;
  end if;

  update public.sources
  set status = 'processing', error_reason = null
  where id = draft.id and user_id = p_user_id;

  insert into public.ingestion_jobs (source_id, user_id, status, attempt)
  select draft.id, p_user_id, 'queued', 0
  where not exists (
    select 1 from public.ingestion_jobs where source_id = draft.id and user_id = p_user_id
  );
end;
$$;

create function public.prepare_source_upload(
  p_source_id uuid,
  p_user_id uuid,
  p_notebook_id uuid,
  p_file_name text,
  p_content_hash text,
  p_byte_size bigint,
  p_intent text,
  p_replace_source_id uuid,
  p_max_sources integer
)
returns table (
  decision text,
  existing_source_id uuid,
  source_id uuid,
  storage_path text,
  reason text
)
language plpgsql
set search_path = ''
as $$
declare
  duplicate_id uuid;
  active_source_count integer;
  replacement_id uuid;
begin
  perform 1 from public.notebooks
  where id = p_notebook_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'notebook not found';
  end if;

  select id into duplicate_id
  from public.sources
  where notebook_id = p_notebook_id and user_id = p_user_id and content_hash = p_content_hash
  order by created_at
  limit 1;

  if duplicate_id is not null and p_intent is null then
    return query select 'duplicate', duplicate_id, null::uuid, null::text, null::text;
    return;
  end if;

  if p_intent = 'replace' then
    if p_replace_source_id is null or p_replace_source_id <> duplicate_id then
      raise exception 'replacement source not found';
    end if;
    replacement_id := duplicate_id;
  elsif p_intent is null or p_intent = 'add' then
    select count(*) into active_source_count
    from public.sources
    where notebook_id = p_notebook_id and user_id = p_user_id and replaces_source_id is null;
    if active_source_count >= p_max_sources then
      return query select
        'rejected', null::uuid, null::uuid, null::text,
        'Ein Notebook darf höchstens 30 Quellen enthalten.';
      return;
    end if;
  else
    raise exception 'invalid upload intent';
  end if;

  insert into public.sources (
    id, user_id, notebook_id, file_name, storage_path, content_hash, byte_size,
    status, replaces_source_id
  ) values (
    p_source_id, p_user_id, p_notebook_id, p_file_name,
    p_user_id::text || '/' || p_notebook_id::text || '/' || p_source_id::text || '.pdf',
    p_content_hash, p_byte_size, 'uploading', replacement_id
  );
  return query select
    'ok', null::uuid, p_source_id,
    p_user_id::text || '/' || p_notebook_id::text || '/' || p_source_id::text || '.pdf',
    null::text;
end;
$$;

drop function public.claim_next_ingestion_job();

create function public.claim_next_ingestion_job(p_source_id uuid default null)
returns table (id uuid, source_id uuid, user_id uuid, attempt integer, correlation_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  claimed public.ingestion_jobs;
begin
  select j.* into claimed
  from public.ingestion_jobs j
  where j.status = 'queued' and (p_source_id is null or j.source_id = p_source_id)
  order by j.id
  for update skip locked
  limit 1;
  if not found then
    return;
  end if;

  update public.ingestion_jobs
  set status = 'running', locked_at = now(), started_at = coalesce(started_at, now())
  where ingestion_jobs.id = claimed.id;
  return query select claimed.id, claimed.source_id, claimed.user_id, claimed.attempt, claimed.correlation_id;
end;
$$;

revoke all on function public.confirm_source_upload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_next_ingestion_job(uuid) from public, anon, authenticated;
grant execute on function public.confirm_source_upload(uuid, uuid) to service_role;
grant execute on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer)
  to service_role;
grant execute on function public.claim_next_ingestion_job(uuid) to service_role;
