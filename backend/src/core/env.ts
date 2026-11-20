import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().url().optional()
);

const optionalNonEmptyString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().optional()
);

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const normalized = val.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    return defaultValue;
  }, z.boolean());

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  FRONTEND_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform((val) =>
      val
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  DATABASE_URL: optionalNonEmptyString,
  LLM_PROVIDER: z.enum(["disabled", "gemini", "groq", "openai", "anthropic"]).default("disabled"),
  LLM_API_KEY: optionalNonEmptyString,
  SARVAM_API_KEY: optionalNonEmptyString,
  LIVE_MARKET_ENABLED: envBoolean(true),
  LIVE_MARKET_CACHE_TTL_MS: z.coerce.number().int().positive().default(45_000),
  YOUTUBE_MONITOR_ENABLED: envBoolean(true),
  YOUTUBE_POLL_INTERVAL_MS: z.coerce.number().int().min(30_000).default(180_000),
  YOUTUBE_DATA_API_KEY: optionalNonEmptyString,
  X_BEARER_TOKEN: optionalNonEmptyString,
  WHATSAPP_PROVIDER: z.enum(["dry_run", "twilio", "callmebot", "meta_cloud"]).default("dry_run"),
  TWILIO_ACCOUNT_SID: optionalNonEmptyString,
  TWILIO_AUTH_TOKEN: optionalNonEmptyString,
  TWILIO_WHATSAPP_FROM: z.string().default("whatsapp:+14155238886"),
  META_WHATSAPP_ACCESS_TOKEN: optionalNonEmptyString,
  META_WHATSAPP_PHONE_NUMBER_ID: optionalNonEmptyString,
  SUBSCRIPTION_ENCRYPTION_KEY: optionalNonEmptyString,
  INTERNAL_CRON_SECRET: optionalNonEmptyString,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fieldNames = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid backend environment configuration for fields: ${fieldNames}`);
  }
  return parsed.data;
}

export const env: AppEnv = loadEnv();
