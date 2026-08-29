drop function if exists public.persist_initial_chat_exchange(uuid, uuid, text, text, text, text, text, jsonb, jsonb);
drop function if exists public.persist_initial_chat_exchange(uuid, uuid, text, text, text, text, text, jsonb, jsonb, text);
drop function if exists public.persist_initial_chat_exchange(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text);
drop function if exists public.persist_initial_chat_exchange(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text, jsonb);

drop function if exists public.persist_chat_exchange(uuid, uuid, text, text, jsonb);
drop function if exists public.persist_chat_exchange(uuid, uuid, text, text, text, jsonb);
drop function if exists public.persist_chat_exchange(uuid, uuid, text, text, text, jsonb, jsonb);

create function public.persist_initial_chat_exchange(
  p_chat_id uuid,
  p_profile_id uuid,
  p_folder_id uuid,
  p_title text,
  p_model_name text,
  p_user_content text,
  p_assistant_content text,
  p_assistant_answer_mode text,
  p_attachments jsonb default '[]'::jsonb,
  p_attachment_target text default 'user',
  p_user_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_created_at timestamptz := clock_timestamp();
  v_chat public.chats;
  v_user public.messages;
  v_assistant public.messages;
  v_target uuid;
begin
  if p_chat_id is null then raise exception 'chat_id_required'; end if;
  if p_assistant_answer_mode is not null and p_assistant_answer_mode not in ('standard','concise','detailed','creative','code','tutorial') then raise exception 'invalid_answer_mode'; end if;
  if p_attachment_target not in ('user','assistant') then raise exception 'invalid_attachment_target'; end if;
  if p_folder_id is not null and not exists(select 1 from public.chat_folders where id = p_folder_id and profile_id = p_profile_id) then raise exception 'folder_not_found'; end if;

  insert into public.chats(id, profile_id, folder_id, title, model_name, created_at, updated_at)
  values(p_chat_id, p_profile_id, p_folder_id, p_title, p_model_name, v_created_at, v_created_at + interval '1 microsecond')
  returning * into v_chat;

  insert into public.messages(chat_id, role, content_text, answer_mode, created_at)
  values(v_chat.id, 'user', p_user_content, null, v_created_at)
  returning * into v_user;

  insert into public.messages(chat_id, role, content_text, answer_mode, created_at)
  values(v_chat.id, 'assistant', p_assistant_content, p_assistant_answer_mode, v_created_at + interval '1 microsecond')
  returning * into v_assistant;

  v_target := case when p_attachment_target = 'assistant' then v_assistant.id else v_user.id end;

  insert into public.message_attachments(message_id, storage_path, mime_type, width, height, size_bytes)
  select v_target, x.storage_path, x.mime_type, x.width, x.height, x.size_bytes
  from jsonb_to_recordset(coalesce(p_attachments, '[]'::jsonb)) as x(storage_path text, mime_type text, width integer, height integer, size_bytes bigint);

  insert into public.message_attachments(message_id, storage_path, mime_type, width, height, size_bytes)
  select v_user.id, x.storage_path, x.mime_type, x.width, x.height, x.size_bytes
  from jsonb_to_recordset(coalesce(p_user_attachments, '[]'::jsonb)) as x(storage_path text, mime_type text, width integer, height integer, size_bytes bigint);

  return jsonb_build_object('chat', to_jsonb(v_chat), 'userMessage', to_jsonb(v_user), 'assistantMessage', to_jsonb(v_assistant));
end;
$$;

revoke all on function public.persist_initial_chat_exchange(uuid, uuid, uuid, text, text, text, text, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.persist_initial_chat_exchange(uuid, uuid, uuid, text, text, text, text, text, jsonb, text, jsonb) to service_role;

create function public.persist_chat_exchange(
  p_chat_id uuid,
  p_profile_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_assistant_answer_mode text,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_created_at timestamptz := clock_timestamp();
  v_user public.messages;
  v_assistant public.messages;
begin
  if p_assistant_answer_mode not in ('standard','concise','detailed','creative','code','tutorial') then raise exception 'invalid_answer_mode'; end if;

  update public.chats
  set updated_at = v_created_at + interval '1 microsecond'
  where id = p_chat_id and profile_id = p_profile_id;
  if not found then raise exception 'chat_not_found'; end if;

  insert into public.messages(chat_id, role, content_text, created_at)
  values(p_chat_id, 'user', p_user_content, v_created_at)
  returning * into v_user;

  insert into public.messages(chat_id, role, content_text, answer_mode, created_at)
  values(p_chat_id, 'assistant', p_assistant_content, p_assistant_answer_mode, v_created_at + interval '1 microsecond')
  returning * into v_assistant;

  insert into public.message_attachments(message_id, storage_path, mime_type, width, height, size_bytes)
  select v_user.id, x.storage_path, x.mime_type, x.width, x.height, x.size_bytes
  from jsonb_to_recordset(coalesce(p_attachments, '[]'::jsonb)) as x(storage_path text, mime_type text, width integer, height integer, size_bytes bigint);

  return jsonb_build_object('userMessage', to_jsonb(v_user), 'assistantMessage', to_jsonb(v_assistant));
end;
$$;

revoke all on function public.persist_chat_exchange(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.persist_chat_exchange(uuid, uuid, text, text, text, jsonb) to service_role;

alter table public.messages drop column structured_payload;
