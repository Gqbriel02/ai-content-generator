import { requireSession } from "@/lib/auth/require-session";
import { createOwnedChat, listChats } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { createChatSchema, historyQuerySchema } from "@/lib/validation/chat";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    sort: url.searchParams.get("sort") ?? "newest",
  });
  if (!parsed.success) return fail("Invalid history query.", 400, parsed.error.flatten());

  try {
    const chats = await listChats(auth.session.profileId, {
      search: parsed.data.q,
      sort: parsed.data.sort,
    });
    return ok(chats);
  } catch (error) {
    console.error("Unable to load chat history.", error);
    return fail("The chat history could not be loaded. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid chat details.", 400, parsed.error.flatten());
  }

  try {
    const chat = await createOwnedChat({
      profileId: auth.session.profileId,
      folderId: parsed.data.folderId,
      title: parsed.data.title,
      modelName: process.env.LM_STUDIO_MODEL ?? "local-model",
    });
    if (!chat) return fail("Folder not found.", 404);
    return ok(chat, { status: 201 });
  } catch (error) {
    console.error("Unable to create chat.", error);
    return fail("The chat could not be created.", 500);
  }
}
