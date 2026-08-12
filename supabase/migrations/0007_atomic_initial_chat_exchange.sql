-- Remove historical rows created by the former eager New Chat flow.
delete from public.chats c
where not exists (select 1 from public.messages m where m.chat_id = c.id);

create or replace function public.persist_initial_chat_exchange(
  p_profile_id uuid,
  p_folder_id uuid,
  p_title text,
  p_model_name text,
  p_user_content text,
  p_assistant_content text,
  p_assistant_answer_mode text,
  p_attachments jsonb default '[]'::jsonb,
  p_assistant_payload jsonb default null
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
begin
  if p_assistant_answer_mode not in ('standard','concise','detailed','creative','code','tutorial') then
    raise exception 'invalid_answer_mode';
  end if;
  if p_folder_id is not null and not exists (
    select 1 from public.chat_folders where id = p_folder_id and profile_id = p_profile_id
  ) then raise exception 'folder_not_found'; end if;

  insert into public.chats (profile_id, folder_id, title, model_name, created_at, updated_at)
  values (p_profile_id, p_folder_id, p_title, p_model_name, v_created_at, v_created_at + interval '1 microsecond')
  returning * into v_chat;

  insert into public.messages (chat_id, role, content_text, answer_mode, created_at)
  values (v_chat.id, 'user', p_user_content, null, v_created_at)
  returning * into v_user;
  insert into public.messages (chat_id, role, content_text, structured_payload, answer_mode, created_at)
  values (v_chat.id, 'assistant', p_assistant_content, p_assistant_payload, p_assistant_answer_mode, v_created_at + interval '1 microsecond')
  returning * into v_assistant;

  insert into public.message_attachments (message_id, storage_path, mime_type, width, height, size_bytes)
  select v_user.id, x.storage_path, x.mime_type, x.width, x.height, x.size_bytes
  from jsonb_to_recordset(coalesce(p_attachments, '[]'::jsonb)) as x(
    storage_path text, mime_type text, width integer, height integer, size_bytes bigint
  );

  return jsonb_build_object('chat', to_jsonb(v_chat), 'userMessage', to_jsonb(v_user), 'assistantMessage', to_jsonb(v_assistant));
end;
$$;

revoke all on function public.persist_initial_chat_exchange(uuid, uuid, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_initial_chat_exchange(uuid, uuid, text, text, text, text, text, jsonb, jsonb) to service_role;
