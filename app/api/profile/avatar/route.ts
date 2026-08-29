import { requireSession } from "@/lib/auth/require-session";
import { findSafeProfileById, updateProfileAvatarPath } from "@/lib/db/profile-repo";
import { fail, ok } from "@/lib/http/responses";
import { withProfileAvatarUrl } from "@/lib/profile/profile-view";
import {
  ProfileAvatarValidationError,
  removeProfileAvatarObject,
  uploadProfileAvatar,
  validateProfileAvatar,
} from "@/lib/storage/profile-avatar";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Choose one profile photo to upload.", 400);
  }
  const files = formData.getAll("avatar");
  const allFiles = Array.from(formData.values()).filter((value): value is File => value instanceof File);
  if (files.length !== 1 || allFiles.length !== 1 || !(files[0] instanceof File)) return fail("Choose one profile photo to upload.", 400);

  let image: Awaited<ReturnType<typeof validateProfileAvatar>>;
  try {
    image = await validateProfileAvatar(files[0]);
  } catch (error) {
    if (error instanceof ProfileAvatarValidationError) return fail(error.message, 400);
    return fail("The profile photo could not be validated.", 400);
  }

  const profile = await findSafeProfileById(auth.session.profileId);
  if (!profile) return fail("Profile not found.", 404);

  let newPath: string | null = null;
  try {
    newPath = await uploadProfileAvatar(auth.session.profileId, image);
    const updated = await updateProfileAvatarPath(auth.session.profileId, newPath);
    if (!updated) throw new Error("Profile not found after avatar upload.");

    if (profile.avatarPath) {
      await removeProfileAvatarObject(auth.session.profileId, profile.avatarPath).catch((error) => {
        console.error("Previous profile avatar cleanup failed after successful replacement.", error);
      });
    }
    return ok(await withProfileAvatarUrl(updated), { status: 201 });
  } catch (error) {
    if (newPath) {
      await removeProfileAvatarObject(auth.session.profileId, newPath).catch((cleanupError) => {
        console.error("New profile avatar cleanup failed after persistence error.", cleanupError);
      });
    }
    console.error("Profile avatar upload failed.", error);
    return fail("Could not upload profile photo. Please try again.", 500);
  }
}

export async function DELETE() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const profile = await findSafeProfileById(auth.session.profileId);
  if (!profile) return fail("Profile not found.", 404);
  if (!profile.avatarPath) return ok(await withProfileAvatarUrl(profile));

  let updated;
  try {
    updated = await updateProfileAvatarPath(auth.session.profileId, null);
  } catch (error) {
    console.error("Profile avatar removal could not be persisted.", error);
    return fail("Could not remove profile photo. Please try again.", 500);
  }
  if (!updated) return fail("Profile not found.", 404);

  await removeProfileAvatarObject(auth.session.profileId, profile.avatarPath).catch((error) => {
    console.error("Profile avatar object cleanup failed after successful removal.", error);
  });
  return ok(await withProfileAvatarUrl(updated));
}
