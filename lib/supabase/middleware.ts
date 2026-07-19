/**
 * Supabase session handling for Next.js middleware (spec §49, §73).
 *
 * Refreshes the auth session on every request, keeps the auth cookies in sync,
 * and forwards the *validated* user id to downstream Server Components via the
 * `x-user-id` request header. This lets `getCurrentUser` skip a second network
 * round-trip to Supabase Auth (the middleware already validated the token),
 * which noticeably speeds up navigation.
 *
 * Security: any client-supplied `x-user-id` is stripped and only re-set from
 * the server-validated session, so the header cannot be spoofed.
 *
 * Runs on the Edge runtime — no Prisma / DB access here (spec §73).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

export const USER_ID_HEADER = 'x-user-id';

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  // Strip any client-forged identity header up front.
  request.headers.delete(USER_ID_HEADER);

  let response = NextResponse.next({ request });

  const env = publicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase Auth. Do not run
  // any code between creating the client and this call (Supabase SSR guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  // Forward the validated id on the request so pages don't re-validate.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete(USER_ID_HEADER);
  if (userId) forwardedHeaders.set(USER_ID_HEADER, userId);

  const forwarded = NextResponse.next({ request: { headers: forwardedHeaders } });
  for (const cookie of response.cookies.getAll()) forwarded.cookies.set(cookie);

  return { response: forwarded, userId };
}
