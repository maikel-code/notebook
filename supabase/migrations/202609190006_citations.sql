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
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_chunk_id uuid;
  current_source_id uuid;
  current_user_id uuid;
  chunk_source_id uuid;
begin
  select chunk_id, source_id, user_id
  into current_chunk_id, current_source_id, current_user_id
  from public.citations
  where id = new.id;

  if not found then
    return new;
  end if;

  if (current_chunk_id is null) <> (current_source_id is null) then
    raise exception 'citation chunk and source must both be present or both be historical';
  end if;

  if current_chunk_id is not null then
    select source_id into chunk_source_id
    from public.chunks
    where id = current_chunk_id and user_id = current_user_id;

    if chunk_source_id is null then
      raise exception 'citation chunk does not belong to owner';
    end if;

    if current_source_id <> chunk_source_id then
      raise exception 'citation source does not match chunk';
    end if;
  end if;

  return new;
end;
$$;

create constraint trigger citations_reference_consistency
after insert or update of chunk_id, source_id, user_id on public.citations
deferrable initially deferred
for each row execute function public.enforce_citation_reference_consistency();
