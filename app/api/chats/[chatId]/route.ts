import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { updateChatSchema } from "@/lib/validation/chat";

export async function GET(_request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
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
  const body = await request.json();
  const parsed = updateChatSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid chat details.", 400, parsed.error.flatten());
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chats")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)
    .eq("profile_id", auth.session.profileId)
    .select("*")
    .single();

  if (error) return fail("The chat could not be updated.", 500, error.message);
  return ok(data);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/chats/[chatId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("profile_id", auth.session.profileId);

  if (error) return fail("The chat could not be deleted.", 500, error.message);
  return ok({ deleted: true });
}
