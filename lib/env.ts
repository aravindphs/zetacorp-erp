/**
 * Centralised, type-safe environment configuration.
 *
 * Server-only variables are validated lazily on first access so that importing
 * this module from a client bundle never throws (the getters simply are not
 * called there). Public variables are safe to read anywhere.
 *
 * Never read `process.env` directly elsewhere — import from here so that a
 * missing/misconfigured variable fails fast with a clear message.
 */
import { z } from 'zod';

const serverSchema = z.object({
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('nsquare-erp'),
  JWT_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

type ServerEnv = z.infer<typeof serverSchema>;
type PublicEnv = z.infer<typeof publicSchema>;

function formatIssues(prefix: string, error: z.ZodError): never {
  const details = error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid ${prefix} environment variables:\n${details}`);
}

let cachedServerEnv: ServerEnv | null = null;

/** Validated server-only environment. Do not call from client components. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) formatIssues('server', parsed.error);
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

let cachedPublicEnv: PublicEnv | null = null;

/**
 * Validated public environment. `NEXT_PUBLIC_*` values are statically inlined
 * by Next.js at build time, so they must be referenced explicitly (not via a
 * dynamic key). Validated lazily so that importing this module does not crash
 * the app before Supabase credentials have been configured.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) formatIssues('public', parsed.error);
  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}
