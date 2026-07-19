import 'server-only';

/**
 * Wraps a Server Action body so thrown `AppError`s and `ZodError`s become a
 * consistent `ActionResult` (mirrors the API's `withApiHandler`). Keeps every
 * action's error handling identical and never leaks internal errors (spec §65).
 */
import { ZodError } from 'zod';
import { isAppError } from '@/lib/errors';
import { logger, serializeError } from '@/lib/logger';
import { actionFail, type ActionResult } from '@/types/action';
import type { ApiError } from '@/types/api';

export async function handleAction<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ApiError[] = error.issues.map((i) => ({
        field: i.path.join('.') || undefined,
        message: i.message,
        code: i.code,
      }));
      return actionFail('Please correct the highlighted fields.', errors);
    }
    if (isAppError(error)) {
      if (error.status >= 500) logger.error(`Action ${error.code}`, serializeError(error));
      return actionFail(error.message, error.errors);
    }
    logger.error('Unhandled action error', serializeError(error));
    return actionFail('Something went wrong. Please try again.');
  }
}
