import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { SafeProfile } from "@/lib/profile/identity";

const SAFE_PROFILE_FIELDS = "id, email, display_name, avatar_path, avatar_color, created_at, updated_at";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_path: string | null;
  avatar_color: string;
  created_at: string;
  updated_at: string;
};

function toSafeProfile(row: ProfileRow): SafeProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findSafeProfileById(profileId: string): Promise<SafeProfile | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select(SAFE_PROFILE_FIELDS).eq("id", profileId).maybeSingle();
  if (error) throw error;
  return data ? toSafeProfile(data as ProfileRow) : null;
}

export async function updateProfileAvatarColor(profileId: string, avatarColor: string): Promise<SafeProfile | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles")
    .update({ avatar_color: avatarColor, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select(SAFE_PROFILE_FIELDS)
    .maybeSingle();
  if (error) throw error;
  return data ? toSafeProfile(data as ProfileRow) : null;
}

export async function updateProfileAvatarPath(profileId: string, avatarPath: string | null): Promise<SafeProfile | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles")
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select(SAFE_PROFILE_FIELDS)
    .maybeSingle();
  if (error) throw error;
  return data ? toSafeProfile(data as ProfileRow) : null;
}
