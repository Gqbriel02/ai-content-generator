import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { updateChatSchema } from "@/lib/validation/chat";
import { deleteOwnedChat } from "@/lib/db/chat-repo";
import { deleteAttachmentObjects } from "@/lib/storage/attachments";
import { z } from "zod";

export async function GET(_request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

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

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .update({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.folderId !== undefined ? { folder_id: parsed.data.folderId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)
    .eq("profile_id", auth.session.profileId)
    .select("id, profile_id, folder_id, title, model_name, rating, created_at, updated_at")
    .single();

  if (error) return fail("The chat could not be updated.", 500, error.message);
  return ok(data);
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
