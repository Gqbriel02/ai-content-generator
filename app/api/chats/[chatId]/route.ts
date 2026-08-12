import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { updateChatSchema } from "@/lib/validation/chat";
import { deleteOwnedChat, renameOwnedChat } from "@/lib/db/chat-repo";
import { deleteAttachmentObjects } from "@/lib/storage/attachments";
import { z } from "zod";

export async function GET(_request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;
  if (!z.string().uuid().safeParse(chatId).success) return fail("Chat not found.", 404);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at")
    .eq("id", chatId)
    .eq("profile_id", auth.session.profileId)
    .single();

  if (error) return fail("Chat not found.", 404);
  return ok(data);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request body must contain valid JSON.", 400);
  }
  const parsed = updateChatSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid chat details.", 400, parsed.error.flatten());
  }

  try {
    const chat = await renameOwnedChat(auth.session.profileId, chatId, parsed.data.title);
    if (!chat) return fail("Chat not found.", 404);
    return ok(chat);
  } catch (error) {
    console.error("Unable to rename chat.", error);
    return fail("The chat could not be renamed. Please try again.", 500);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;
  if (!z.string().uuid().safeParse(chatId).success) {
    return fail("Chat not found.", 404);
  }

  try {
    const result = await deleteOwnedChat(auth.session.profileId, chatId);
    if (!result) return fail("Chat not found.", 404);

    try {
      await deleteAttachmentObjects(result.storagePaths);
    } catch (error) {
      // The database deletion is authoritative. Do not report it as failed and
      // encourage a duplicate request merely because post-delete cleanup failed.
      console.error("Deleted chat but could not clean up attachment objects.", error);
    }

    return ok({ success: true });
  } catch (error) {
    console.error("Unable to delete chat.", error);
    return fail("The chat could not be deleted. Please try again.", 500);
  }
}
