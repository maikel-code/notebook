create unique index sources_one_replacement_draft_per_source_idx
  on public.sources(replaces_source_id)
  where replaces_source_id is not null;

create or replace function public.prepare_source_upload(
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
    if exists (
      select 1 from public.sources
      where replaces_source_id = replacement_id
        and user_id = p_user_id
        and notebook_id = p_notebook_id
    ) then
      return query select
        'rejected', null::uuid, null::uuid, null::text,
        'Diese Quelle wird bereits ersetzt.';
      return;
    end if;
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

revoke all on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.prepare_source_upload(uuid, uuid, uuid, text, text, bigint, text, uuid, integer)
  to service_role;
