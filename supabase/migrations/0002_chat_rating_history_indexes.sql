alter table public.chats
  add column if not exists rating smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chats_rating_check'
      and conrelid = 'public.chats'::regclass
  ) then
    alter table public.chats
      add constraint chats_rating_check
      check (rating in (-1, 1));
  end if;
end
$$;

create index if not exists idx_chats_profile_id_created_at
  on public.chats(profile_id, created_at);

create index if not exists idx_messages_chat_id_created_at
  on public.messages(chat_id, created_at);
