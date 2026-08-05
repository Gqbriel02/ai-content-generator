import { requireSession } from "@/lib/auth/require-session";
import { updateChatRating } from "@/lib/db/chat-repo";
import { fail, ok } from "@/lib/http/responses";
import { ratingSchema } from "@/lib/validation/chat";
import { z } from "zod";

export async function PUT(request: Request, ctx: RouteContext<"/api/chats/[chatId]/rating">) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const { chatId } = await ctx.params;

  if (!z.string().uuid().safeParse(chatId).success) {
    return fail("Invalid chat identifier.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("The request body must contain valid JSON.", 400);
  }

  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) return fail("Rating must be 1, -1, or null.", 400);

  try {
    const chat = await updateChatRating(auth.session.profileId, chatId, parsed.data.rating);
    if (!chat) return fail("Chat not found.", 404);
    return ok({ rating: chat.rating });
  } catch (error) {
    console.error("Unable to update chat rating.", error);
    return fail("The rating could not be saved. Please try again.", 500);
  }
}
