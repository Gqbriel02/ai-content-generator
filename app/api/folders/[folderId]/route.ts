import { requireSession } from "@/lib/auth/require-session";
import { fail, ok } from "@/lib/http/responses";
import { updateFolderSchema } from "@/lib/validation/chat";
import { deleteOwnedFolder, renameOwnedFolder } from "@/lib/db/chat-repo";
import { deleteAttachmentObjects } from "@/lib/storage/attachments";
import { z } from "zod";

export async function PATCH(request: Request, ctx: RouteContext<"/api/folders/[folderId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { folderId } = await ctx.params;
  if (!z.string().uuid().safeParse(folderId).success) return fail("Folder not found.", 404);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("The request body must contain valid JSON.", 400); }
  const parsed = updateFolderSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid folder details.", 400, parsed.error.flatten());
  }

  try {
    const folder = await renameOwnedFolder(auth.session.profileId, folderId, parsed.data.name);
    if (!folder) return fail("Folder not found.", 404);
    return ok(folder);
  } catch (error) {
    console.error("Unable to rename folder.", error);
    return fail("The folder could not be renamed. Please try again.", 500);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/folders/[folderId]">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { folderId } = await ctx.params;

  if (!z.string().uuid().safeParse(folderId).success) return fail("Folder not found.", 404);
  try {
    const result = await deleteOwnedFolder(auth.session.profileId, folderId);
    if (!result) return fail("Folder not found.", 404);
    try { await deleteAttachmentObjects(result.storagePaths); }
    catch (error) { console.error("Deleted folder but could not clean up attachment objects.", error); }
    return ok({ success: true });
  } catch (error) {
    console.error("Unable to delete folder.", error);
    return fail("The folder could not be deleted. Please try again.", 500);
  }
}
