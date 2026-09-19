create extension if not exists vector with schema extensions;

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

create index chunks_embedding_hnsw_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);
