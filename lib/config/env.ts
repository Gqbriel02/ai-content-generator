import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  LM_STUDIO_BASE_URL: z.string().url().default("http://localhost:1234/v1"),
  LM_STUDIO_API_KEY: z.string().default("lm-studio"),
  LM_STUDIO_MODEL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_BUCKET: z.string().default("chat-uploads"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  JWT_SECRET: process.env.JWT_SECRET,
  LM_STUDIO_BASE_URL: process.env.LM_STUDIO_BASE_URL,
  LM_STUDIO_API_KEY: process.env.LM_STUDIO_API_KEY,
  LM_STUDIO_MODEL: process.env.LM_STUDIO_MODEL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_BUCKET,
  NODE_ENV: process.env.NODE_ENV,
});
