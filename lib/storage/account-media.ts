import { createServerSupabaseClient } from "@/lib/db/supabase";
import { CHAT_MEDIA_BUCKET } from "@/lib/storage/chat-media";
import { PROFILE_MEDIA_BUCKET } from "@/lib/storage/profile-avatar";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 100;

type StorageEntry = { id: string | null; name: string; metadata?: unknown };

function isFolder(entry: StorageEntry) {
  return entry.id === null && entry.metadata == null;
}

export async function removeStoragePrefix(bucket: string, profileId: string) {
  if (!UUID_PATTERN.test(profileId)) throw new Error("Invalid account media owner.");
  const storage = createServerSupabaseClient().storage.from(bucket);
  const objectPaths: string[] = [];
  const directories = [profileId];

  while (directories.length > 0) {
    const directory = directories.pop()!;
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await storage.list(directory, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      const entries = (data ?? []) as StorageEntry[];
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`;
        if (isFolder(entry)) directories.push(path);
        else objectPaths.push(path);
      }
      if (entries.length < LIST_PAGE_SIZE) break;
    }
  }

  for (let index = 0; index < objectPaths.length; index += REMOVE_BATCH_SIZE) {
    const { error } = await storage.remove(objectPaths.slice(index, index + REMOVE_BATCH_SIZE));
    if (error) throw error;
  }
}

export async function removeProfileOwnedAccountMedia(profileId: string) {
  try {
    await removeStoragePrefix(CHAT_MEDIA_BUCKET, profileId);
  } catch (error) {
    console.error("Account deletion chat storage cleanup failed.", error);
    throw error;
  }
  try {
    await removeStoragePrefix(PROFILE_MEDIA_BUCKET, profileId);
  } catch (error) {
    console.error("Account deletion profile storage cleanup failed.", error);
    throw error;
  }
}
