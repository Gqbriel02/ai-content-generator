import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { requireSession } from "@/lib/auth/require-session";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fail, ok } from "@/lib/http/responses";
import { z } from "zod";

const ACCEPTED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("No file was provided.", 400);
  }

  if (!ACCEPTED_MIME.has(file.type)) {
    return fail("This file type is not supported.", 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return fail("The file exceeds the 8 MB limit.", 400);
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
    return fail("The file could not be uploaded.", 500, error.message);
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

export async function DELETE(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("The request body must contain valid JSON.", 400); }
  const parsed = z.object({ storagePaths: z.array(z.string().min(1)).max(8) }).strict().safeParse(body);
  if (!parsed.success || parsed.data.storagePaths.some((path) => !path.startsWith(`${auth.session.profileId}/`))) {
    return fail("Invalid attachment paths.", 400);
  }
  const supabase = createServerSupabaseClient();
  const { data: references, error: referenceError } = await supabase.from("message_attachments")
    .select("storage_path").in("storage_path", parsed.data.storagePaths);
  if (referenceError) return fail("Attachments could not be checked.", 500);
  const referenced = new Set((references ?? []).map((item: { storage_path: string }) => item.storage_path));
  const removable = parsed.data.storagePaths.filter((path) => !referenced.has(path));
  if (removable.length) {
    const { error } = await supabase.storage.from(env.NEXT_PUBLIC_SUPABASE_BUCKET).remove(removable);
    if (error) return fail("Attachments could not be removed.", 500);
  }
  return ok({ removed: removable.length });
}
