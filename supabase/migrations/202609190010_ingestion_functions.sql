create function public.confirm_source_upload(p_source_id uuid, p_user_id uuid)
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

create function public.retry_source_ingestion(p_source_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.sources
  set status = 'processing', error_reason = null
  where id = p_source_id and user_id = p_user_id and status = 'failed';
  if not found then
    raise exception 'failed source not found';
  end if;

  insert into public.ingestion_jobs (source_id, user_id, status, attempt)
  values (p_source_id, p_user_id, 'queued', 0);
end;
$$;

create function public.claim_next_ingestion_job()
returns table (id uuid, source_id uuid, user_id uuid, attempt integer, correlation_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  claimed public.ingestion_jobs;
begin
  select * into claimed
  from public.ingestion_jobs
  where status = 'queued'
  order by id
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

create function public.replace_source_chunks(p_source_id uuid, p_user_id uuid, p_chunks jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.sources where id = p_source_id and user_id = p_user_id for update;
  if not found then
    raise exception 'source not found';
  end if;

  delete from public.chunks where source_id = p_source_id and user_id = p_user_id;
  insert into public.chunks (
    source_id, user_id, ordinal, page_start, page_end, content, char_count, embedding
  )
  select
    p_source_id,
    p_user_id,
    (entry ->> 'ordinal')::integer,
    (entry ->> 'page_start')::integer,
    (entry ->> 'page_end')::integer,
    entry ->> 'content',
    (entry ->> 'char_count')::integer,
    ((entry -> 'embedding')::text)::extensions.vector
  from jsonb_array_elements(p_chunks) as entry;
end;
$$;

create function public.sweep_stale_ingestion_jobs()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  with stale as (
    select id, source_id, user_id, attempt
    from public.ingestion_jobs
    where status = 'running' and locked_at < now() - interval '5 minutes'
    for update skip locked
  ), updated as (
    update public.ingestion_jobs job
    set attempt = stale.attempt + 1,
        status = case when stale.attempt + 1 >= 3 then 'failed' else 'queued' end,
        locked_at = null,
        finished_at = case when stale.attempt + 1 >= 3 then now() else null end,
        last_error = 'Die PDF-Verarbeitung hat das Zeitlimit überschritten.'
    from stale
    where job.id = stale.id
    returning stale.source_id, stale.user_id, job.status
  )
  update public.sources source
  set status = case when updated.status = 'failed' then 'failed' else source.status end,
      error_reason = case
        when updated.status = 'failed' then 'Die PDF-Verarbeitung hat das Zeitlimit überschritten.'
        else source.error_reason
      end
  from updated
  where source.id = updated.source_id and source.user_id = updated.user_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.confirm_source_upload(uuid, uuid) from public, anon, authenticated;
revoke all on function public.retry_source_ingestion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_next_ingestion_job() from public, anon, authenticated;
revoke all on function public.replace_source_chunks(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sweep_stale_ingestion_jobs() from public, anon, authenticated;
grant execute on function public.confirm_source_upload(uuid, uuid) to service_role;
grant execute on function public.retry_source_ingestion(uuid, uuid) to service_role;
grant execute on function public.claim_next_ingestion_job() to service_role;
grant execute on function public.replace_source_chunks(uuid, uuid, jsonb) to service_role;
grant execute on function public.sweep_stale_ingestion_jobs() to service_role;
