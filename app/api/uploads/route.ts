import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";

const ACCEPTED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("Fisier lipsa.", 400);
  }

  if (!ACCEPTED_MIME.has(file.type)) {
    return fail("Tip de fisier neacceptat.", 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return fail("Fisierul depaseste 8MB.", 400);
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const storagePath = `${auth.session.profileId}/${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return fail("Upload esuat.", 500, error.message);
  }

  const { data: signedUrlData } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  return ok({
    storagePath,
    mimeType: file.type,
    sizeBytes: file.size,
    signedUrl: signedUrlData?.signedUrl ?? null,
  });
}
