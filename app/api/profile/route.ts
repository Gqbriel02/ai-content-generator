import { requireSession } from "@/lib/auth/require-session";
import { findSafeProfileById, updateProfileAvatarColor } from "@/lib/db/profile-repo";
import { fail, ok } from "@/lib/http/responses";
import { updateAvatarColorSchema } from "@/lib/validation/profile";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const profile = await findSafeProfileById(auth.session.profileId);
  return profile ? ok(profile) : fail("Profile not found.", 404);
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
  return profile ? ok(profile) : fail("Profile not found.", 404);
}
