import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { updateFolderSchema } from "@/lib/validation/chat";

export async function PATCH(request: Request, ctx: RouteContext<"/api/folders/[folderId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { folderId } = await ctx.params;
  const body = await request.json();
  const parsed = updateFolderSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Date invalide.", 400, parsed.error.flatten());
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chat_folders")
    .update(parsed.data)
    .eq("id", folderId)
    .eq("profile_id", auth.session.profileId)
    .select("*")
    .single();

  if (error) return fail("Nu s-a putut actualiza folderul.", 500, error.message);
  return ok(data);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/folders/[folderId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { folderId } = await ctx.params;

  const supabase = createServerSupabaseClient();
  await supabase
    .from("chats")
    .update({ folder_id: null })
    .eq("folder_id", folderId)
    .eq("profile_id", auth.session.profileId);

  const { error } = await supabase
    .from("chat_folders")
    .delete()
    .eq("id", folderId)
    .eq("profile_id", auth.session.profileId);

  if (error) return fail("Nu s-a putut sterge folderul.", 500, error.message);
  return ok({ deleted: true });
}
