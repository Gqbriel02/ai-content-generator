create or replace function public.persist_chat_exchange(
  p_chat_id uuid,
  p_profile_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_assistant_payload jsonb default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_created_at timestamptz := clock_timestamp();
  v_user_message jsonb;
  v_assistant_message jsonb;
begin
  update public.chats
  set updated_at = v_created_at + interval '1 microsecond'
  where id = p_chat_id
    and profile_id = p_profile_id;

  if not found then
    raise exception 'chat_not_found';
  end if;

  with inserted as (
    insert into public.messages (chat_id, role, content_text, structured_payload, created_at)
    values
      (p_chat_id, 'user', p_user_content, null, v_created_at),
      (
        p_chat_id,
        'assistant',
        p_assistant_content,
        p_assistant_payload,
        v_created_at + interval '1 microsecond'
      )
    returning *
  )
  select
    (jsonb_agg(to_jsonb(inserted)) filter (where role = 'user'))->0,
    (jsonb_agg(to_jsonb(inserted)) filter (where role = 'assistant'))->0
  into v_user_message, v_assistant_message
  from inserted;

  return jsonb_build_object(
    'userMessage', v_user_message,
    'assistantMessage', v_assistant_message
  );
end;
$$;

revoke all on function public.persist_chat_exchange(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.persist_chat_exchange(uuid, uuid, text, text, jsonb) from anon;
revoke all on function public.persist_chat_exchange(uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.persist_chat_exchange(uuid, uuid, text, text, jsonb) to service_role;
