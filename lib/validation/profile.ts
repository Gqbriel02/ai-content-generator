import { z } from "zod";
import { normalizeAvatarColor } from "@/lib/profile/identity";

export const updateAvatarColorSchema = z.object({
  avatarColor: z.string().transform((value, context) => {
    const normalized = normalizeAvatarColor(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "Enter a six-digit HEX color such as #228BE6." });
      return z.NEVER;
    }
    return normalized;
  }),
}).strict();
