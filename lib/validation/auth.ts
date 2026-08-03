import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "Parola trebuie sa aiba minim 8 caractere.")
  .regex(/[A-Z]/, "Parola trebuie sa contina o litera mare.")
  .regex(/[a-z]/, "Parola trebuie sa contina o litera mica.")
  .regex(/[0-9]/, "Parola trebuie sa contina o cifra.");

export const registerSchema = z.object({
  email: z.string().trim().email("Email invalid."),
  password: passwordRule,
  displayName: z
    .string()
    .trim()
    .min(2, "Numele afisat trebuie sa aiba minim 2 caractere.")
    .max(60, "Numele afisat poate avea maxim 60 de caractere."),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
