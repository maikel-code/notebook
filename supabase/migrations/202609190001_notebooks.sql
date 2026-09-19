create extension if not exists pgcrypto with schema extensions;

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
