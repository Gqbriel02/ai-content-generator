import { requireSession } from "@/lib/auth/require-session";
import { clearAuthCookie } from "@/lib/auth/session";
import { deleteProfileById, findSafeProfileById, updateProfileAvatarColor } from "@/lib/db/profile-repo";
import { fail, ok } from "@/lib/http/responses";
import { updateAvatarColorSchema } from "@/lib/validation/profile";
import { withProfileAvatarUrl } from "@/lib/profile/profile-view";
import { removeProfileOwnedAccountMedia } from "@/lib/storage/account-media";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const profile = await findSafeProfileById(auth.session.profileId);
  return profile ? ok(await withProfileAvatarUrl(profile)) : fail("Profile not found.", 404);
}

export async function PATCH(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid profile update.", 400);
  }
  const parsed = updateAvatarColorSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid profile update.", 400, parsed.error.flatten());

  const profile = await updateProfileAvatarColor(auth.session.profileId, parsed.data.avatarColor);
  return profile ? ok(await withProfileAvatarUrl(profile)) : fail("Profile not found.", 404);
}

export async function DELETE() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    await removeProfileOwnedAccountMedia(auth.session.profileId);
  } catch {
    return fail("Could not delete your account. Please try again.", 503);
  }

  try {
    const deleted = await deleteProfileById(auth.session.profileId);
    if (!deleted) return fail("Could not delete your account. Please try again.", 404);
  } catch (error) {
    console.error("Account database deletion failed after storage cleanup.", error);
    return fail("Could not delete your account. Please try again.", 503);
  }

  await clearAuthCookie();
  return ok({ success: true });
}
