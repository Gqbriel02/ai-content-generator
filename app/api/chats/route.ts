import { requireSession } from "@/lib/auth/require-session";
import { listChats } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { historyQuerySchema } from "@/lib/validation/chat";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    sort: url.searchParams.get("sort") ?? "newest",
    type: url.searchParams.get("type") ?? "all",
  });
  if (!parsed.success) return fail("Invalid history query.", 400, parsed.error.flatten());

  try {
    const chats = await listChats(auth.session.profileId, {
      search: parsed.data.q,
      sort: parsed.data.sort,
      type: parsed.data.type,
    });
    return ok(chats);
  } catch (error) {
    console.error("Unable to load chat history.", error);
    return fail("The chat history could not be loaded. Please try again.", 500);
  }
}
