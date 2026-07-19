/**
 * Activity logging (spec §39, §45 — "every login generates an activity log";
 * "every mutation generates an Activity Log", §75).
 *
 * Records normal user activity (logins, creates, downloads…). Best-effort: a
 * logging failure must never break the underlying business action, so writes
 * are wrapped and errors are swallowed after being logged to the app logger.
 */
import 'server-only';
import { prisma } from '@/lib/prisma';
import { logger, serializeError } from '@/lib/logger';
import { extractRequestMeta, type RequestMeta } from '@/utils/request-meta';

export interface ActivityInput {
  userId: string | null;
  activity: string;
  module: string;
  referenceId?: string | null;
  meta?: Partial<RequestMeta>;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        activity: input.activity,
        module: input.module,
        referenceId: input.referenceId ?? null,
        ipAddress: input.meta?.ipAddress ?? null,
        device: input.meta?.device ?? null,
        browser: input.meta?.browser ?? null,
      },
    });
  } catch (error) {
    logger.error('Failed to write activity log', {
      activity: input.activity,
      module: input.module,
      ...serializeError(error),
    });
  }
}

/** Convenience overload that derives IP/browser/device from request headers. */
export async function logActivityWithRequest(
  input: Omit<ActivityInput, 'meta'>,
  headers: { get(name: string): string | null },
): Promise<void> {
  await logActivity({ ...input, meta: extractRequestMeta(headers) });
}
