'use server';

/**
 * Authentication server actions (spec §46–§48).
 *
 * Rules enforced here (never trust the client):
 *   - Zod validation of credentials.
 *   - Login rate limiting (spec §67: 5 / 15 min).
 *   - Account must exist, be non-deleted, and ACTIVE (spec §14).
 *   - Generic error messages — never reveal which field was wrong (spec §48).
 *   - Every login writes an activity log (spec §45).
 */
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { loginSchema, type LoginInput } from '@/features/auth/auth.schema';
import { actionFail, actionOk, type ActionResult } from '@/types/action';
import { consumeRateLimit } from '@/lib/rate-limit';
import { RATE_LIMIT } from '@/constants/app';
import { logActivityWithRequest } from '@/services/activity-log.service';
import { extractRequestMeta } from '@/utils/request-meta';
import { logger, serializeError } from '@/lib/logger';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

export async function loginAction(
  input: LoginInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail('Please correct the highlighted fields.', [
      ...parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    ]);
  }
  const { email, password } = parsed.data;

  const headerList = await headers();
  const meta = extractRequestMeta(headerList);

  // Rate limit by IP + email (spec §67).
  const rlKey = `login:${meta.ipAddress ?? 'unknown'}:${email}`;
  const rl = consumeRateLimit(rlKey, RATE_LIMIT.LOGIN.limit, RATE_LIMIT.LOGIN.windowSeconds);
  if (!rl.allowed) {
    const seconds = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return actionFail(`Too many attempts. Please try again in ${seconds} seconds.`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return actionFail(GENERIC_LOGIN_ERROR);
  }

  // Verify the application account is valid and active (spec §14, §48).
  const dbUser = await prisma.user.findFirst({
    where: { id: data.user.id, isDeleted: false },
    select: { id: true, status: true },
  });

  if (!dbUser) {
    await supabase.auth.signOut();
    return actionFail(GENERIC_LOGIN_ERROR);
  }
  if (dbUser.status !== 'ACTIVE') {
    await supabase.auth.signOut();
    return actionFail('Your account is not active. Please contact your administrator.');
  }

  try {
    await prisma.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
  } catch (e) {
    logger.warn('Failed to update lastLoginAt', serializeError(e));
  }

  await logActivityWithRequest(
    { userId: dbUser.id, activity: 'Logged in', module: 'auth', referenceId: dbUser.id },
    headerList,
  );

  return actionOk({ redirectTo: '/dashboard' }, 'Signed in successfully.');
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const headerList = await headers();
    await logActivityWithRequest(
      { userId: user.id, activity: 'Logged out', module: 'auth', referenceId: user.id },
      headerList,
    );
  }

  await supabase.auth.signOut();
  return actionOk({ redirectTo: '/login' }, 'Signed out.');
}
