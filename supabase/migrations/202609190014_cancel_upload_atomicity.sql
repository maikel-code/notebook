create function public.cancel_source_upload(p_source_id uuid, p_user_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  draft public.sources;
begin
  select * into draft
  from public.sources
  where id = p_source_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'source not found';
  end if;
  if draft.status <> 'uploading' then
    raise exception 'source is not an upload draft';
  end if;

  delete from public.sources where id = draft.id and user_id = p_user_id;
  return draft.storage_path;
end;
$$;

revoke all on function public.cancel_source_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_source_upload(uuid, uuid) to service_role;
