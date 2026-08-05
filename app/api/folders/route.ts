import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { createFolderSchema } from "@/lib/validation/chat";
import { listFolders } from "@/lib/db/chat-repo";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const folders = await listFolders(auth.session.profileId);
  return ok(folders);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Folder invalid.", 400, parsed.error.flatten());
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("chat_folders")
    .insert({
      profile_id: auth.session.profileId,
      name: parsed.data.name,
      position: 0,
    })
    .select("*")
    .single();

  if (error) {
    return fail("The folder could not be created.", 500, error.message);
  }
  return ok(data, { status: 201 });
}
