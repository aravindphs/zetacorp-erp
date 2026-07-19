/**
 * Lightweight fixed-window rate limiter (spec §67).
 *
 * This in-memory implementation is functional per server instance and is used
 * to throttle sensitive endpoints (login, password change, exports). On a
 * multi-instance/serverless deployment it is best-effort per instance; swap the
 * `RateLimitStore` for a shared store (e.g. Upstash Redis) in production for
 * global accuracy. The call sites do not change — only the store does.
 */
import { RateLimitError } from '@/lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  get(key: string): Bucket | undefined;
  set(key: string, bucket: Bucket): void;
}

class MemoryStore implements RateLimitStore {
  private readonly map = new Map<string, Bucket>();
  get(key: string): Bucket | undefined {
    return this.map.get(key);
  }
  set(key: string, bucket: Bucket): void {
    this.map.set(key, bucket);
    // Opportunistic cleanup to bound memory.
    if (this.map.size > 10_000) {
      const now = Date.now();
      for (const [k, b] of this.map) if (b.resetAt < now) this.map.delete(k);
    }
  }
}

const store: RateLimitStore = new MemoryStore();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Consume one unit for `key`. Returns whether the request is allowed and how
 * many remain in the current window.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
    store.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Consume one unit and throw `RateLimitError` (429) when exhausted. */
export function enforceRateLimit(key: string, limit: number, windowSeconds: number): void {
  const result = consumeRateLimit(key, limit, windowSeconds);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitError(`Too many attempts. Please try again in ${seconds} seconds.`);
  }
}
