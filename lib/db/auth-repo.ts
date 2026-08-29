import { createServerSupabaseClient } from "@/lib/db/supabase";

export async function findProfileByEmail(email: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, password_hash, display_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProfile(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  avatarColor: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      email: input.email.toLowerCase(),
      password_hash: input.passwordHash,
      display_name: input.displayName,
      avatar_path: null,
      avatar_color: input.avatarColor,
    })
    .select("id, email, display_name, avatar_path, avatar_color, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function createAuthSession(input: {
  profileId: string;
  tokenJti: string;
  expiresAt: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("auth_sessions").insert({
    profile_id: input.profileId,
    token_jti: input.tokenJti,
    expires_at: input.expiresAt,
  });
  if (error) throw error;
}

export async function revokeAuthSession(tokenJti: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_jti", tokenJti)
    .is("revoked_at", null);

  if (error) throw error;
}
