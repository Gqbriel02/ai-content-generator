import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: passwordRule,
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters long.")
    .max(60, "Display name must be no more than 60 characters long."),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
