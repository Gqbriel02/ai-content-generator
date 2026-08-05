import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { createMessage } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { submitTaskAnswerSchema } from "@/lib/validation/chat";
import { generateAssistantReply, LmStudioError } from "@/lib/ai/lmstudio";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/messages/[messageId]/interactions">,
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { messageId } = await ctx.params;

  const body = await request.json();
  const parsed = submitTaskAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid task response.", 400, parsed.error.flatten());
  }

  const supabase = createServerSupabaseClient();
  const { data: sourceMessage, error: sourceMessageError } = await supabase
    .from("messages")
    .select("id, chat_id, role, structured_payload")
    .eq("id", messageId)
    .single();

  if (sourceMessageError || !sourceMessage) {
    return fail("The source message was not found.", 404);
  }

  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, profile_id, system_prompt")
    .eq("id", sourceMessage.chat_id)
    .single();

  if (chatError || !chat || chat.profile_id !== auth.session.profileId) {
    return fail("You do not have access to this message.", 403);
  }

  const answerText = `Task answer: ${JSON.stringify(parsed.data.values)}`;
  await createMessage({
    chatId: chat.id,
    role: "tool",
    contentText: answerText,
    structuredPayload: parsed.data.values,
  });

  let followUp = "";
  try {
    followUp = await generateAssistantReply([
      {
        role: "system",
        contentText:
          chat.system_prompt ??
          "You are a practical AI assistant. Use the task answers to continue productively.",
        attachments: [],
      },
      {
        role: "user",
        contentText: `The user submitted this task form response: ${answerText}. Continue helpfully.`,
        attachments: [],
      },
    ]);
  } catch (error) {
    if (error instanceof LmStudioError) {
      return fail(error.message, error.status);
    }
    return fail("The AI response could not be generated. Please try again.", 500);
  }

  const assistant = await createMessage({
    chatId: chat.id,
    role: "assistant",
    contentText: followUp,
  });

  return ok({ assistantMessage: assistant });
}
