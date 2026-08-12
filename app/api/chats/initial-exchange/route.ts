import { requireSession } from "@/lib/auth/require-session";
import { findFolderById, persistInitialChatExchange } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { hitRateLimit } from "@/lib/http/rate-limit";
import { createInitialExchangeSchema } from "@/lib/validation/chat";
import { createAttachmentDataUrl } from "@/lib/storage/attachments";
import { generateAssistantReply, LmStudioError } from "@/lib/ai/lmstudio";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("The request body must contain valid JSON.", 400); }
  const parsed = createInitialExchangeSchema.safeParse(body);
  if (!parsed.success) return fail("Enter a non-empty message of no more than 12,000 characters.", 400, parsed.error.flatten());
  if (parsed.data.folderId && !(await findFolderById(auth.session.profileId, parsed.data.folderId))) return fail("Folder not found.", 404);
  if (parsed.data.attachments.some((item) => !item.storagePath.startsWith(`${auth.session.profileId}/`))) return fail("Invalid attachment.", 400);
  if (hitRateLimit(`chat:${auth.session.profileId}`, 40)) return fail("You have reached the request limit. Please try again in one minute.", 429);

  try {
    const attachments = await Promise.all(parsed.data.attachments.map(async (item) => ({
      dataUrl: await createAttachmentDataUrl(item.storagePath, item.mimeType), mimeType: item.mimeType,
    })));
    const assistantText = await generateAssistantReply([{ role: "user", contentText: parsed.data.content, attachments }], parsed.data.answerMode);
    const result = await persistInitialChatExchange({
      profileId: auth.session.profileId, folderId: parsed.data.folderId,
      title: `Chat ${new Date().toLocaleString()}`, modelName: process.env.LM_STUDIO_MODEL ?? "local-model",
      userContent: parsed.data.content, assistantContent: assistantText,
      assistantAnswerMode: parsed.data.answerMode, attachments: parsed.data.attachments,
    });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof LmStudioError) return fail(error.message, error.status);
    console.error("Unable to create initial chat exchange.", error);
    return fail("The generated response could not be saved. Please try again.", 500);
  }
}
