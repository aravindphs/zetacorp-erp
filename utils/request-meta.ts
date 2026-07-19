/**
 * Extract request metadata for activity logging (spec §39): IP, browser, and
 * device from standard proxy/user-agent headers. Best-effort — never throws.
 */
export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  device: string | null;
}

/** Accepts anything with a Headers-like `get` (Request.headers, next/headers). */
interface HeaderLike {
  get(name: string): string | null;
}

export function extractRequestMeta(headers: HeaderLike): RequestMeta {
  const forwardedFor = headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? null;
  const userAgent = headers.get('user-agent');

  return {
    ipAddress,
    userAgent,
    browser: userAgent ? detectBrowser(userAgent) : null,
    device: userAgent ? detectDevice(userAgent) : null,
  };
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua)) return 'Safari';
  return 'Unknown';
}

function detectDevice(ua: string): string {
  if (/mobile|iphone|android.*mobile/i.test(ua)) return 'Mobile';
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return 'Tablet';
  return 'Desktop';
}
