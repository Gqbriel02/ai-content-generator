import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { listChats } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { createChatSchema } from "@/lib/validation/chat";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const chats = await listChats(auth.session.profileId);
  return ok(chats);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid chat details.", 400, parsed.error.flatten());
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .insert({
      profile_id: auth.session.profileId,
      folder_id: parsed.data.folderId ?? null,
      title: parsed.data.title,
      system_prompt:
        parsed.data.systemPrompt ??
        "You are a practical and concise AI assistant. Keep answers structured and actionable.",
      model_name: process.env.LM_STUDIO_MODEL ?? "local-model",
    })
    .select("*")
    .single();

  if (error) return fail("The chat could not be created.", 500, error.message);
  return ok(data, { status: 201 });
}
