alter table public.chats
  drop constraint if exists chats_folder_id_fkey;

alter table public.chats
  add constraint chats_folder_id_fkey
  foreign key (folder_id)
  references public.chat_folders(id)
  on delete cascade;
