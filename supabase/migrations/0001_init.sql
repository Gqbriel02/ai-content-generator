create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_jti text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_folders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.chat_folders(id) on delete set null,
  title text not null,
  model_name text not null,
  system_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content_text text not null default '',
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_sessions_profile_id on public.auth_sessions(profile_id);
create index if not exists idx_auth_sessions_token_jti on public.auth_sessions(token_jti);
create index if not exists idx_chat_folders_profile_id on public.chat_folders(profile_id);
create index if not exists idx_chats_profile_id on public.chats(profile_id);
create index if not exists idx_chats_folder_id on public.chats(folder_id);
create index if not exists idx_messages_chat_id_created_at on public.messages(chat_id, created_at);
create index if not exists idx_attachments_message_id on public.message_attachments(message_id);

alter table public.profiles enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.chat_folders enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;

drop policy if exists deny_profiles_all on public.profiles;
create policy deny_profiles_all on public.profiles for all using (false);

drop policy if exists deny_auth_sessions_all on public.auth_sessions;
create policy deny_auth_sessions_all on public.auth_sessions for all using (false);

drop policy if exists deny_chat_folders_all on public.chat_folders;
create policy deny_chat_folders_all on public.chat_folders for all using (false);

drop policy if exists deny_chats_all on public.chats;
create policy deny_chats_all on public.chats for all using (false);

drop policy if exists deny_messages_all on public.messages;
create policy deny_messages_all on public.messages for all using (false);

drop policy if exists deny_message_attachments_all on public.message_attachments;
create policy deny_message_attachments_all on public.message_attachments for all using (false);
