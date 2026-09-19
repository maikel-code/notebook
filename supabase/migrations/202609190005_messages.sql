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
    unsupported_reason is null
    or unsupported_reason in (
      'no_selection',
      'no_ready_source',
      'below_similarity_threshold',
      'invalid_citations'
    )
  ),
  constraint messages_user_shape check (
    role <> 'user'
    or (
      status = 'complete'
      and question_message_id is null
      and attempt_no is null
      and unsupported_reason is null
      and selected_sources_snapshot is not null
      and jsonb_typeof(selected_sources_snapshot) = 'array'
      and char_length(content) between 1 and 2000
    )
  ),
  constraint messages_assistant_shape check (
    role <> 'assistant'
    or (
      question_message_id is not null
      and attempt_no >= 1
      and selected_sources_snapshot is null
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
  on public.messages(notebook_id)
  where role = 'assistant' and status = 'streaming';
