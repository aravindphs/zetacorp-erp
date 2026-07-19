/**
 * Result type for Server Actions — a discriminated union mirroring the API
 * envelope (spec §63) so client components handle success/failure uniformly.
 */
import type { ApiError } from '@/types/api';

export type ActionResult<TData = null> =
  | { success: true; message: string; data: TData }
  | { success: false; message: string; errors: ApiError[] };

export function actionOk<TData>(data: TData, message = 'OK'): ActionResult<TData> {
  return { success: true, message, data };
}

export function actionFail(message: string, errors: ApiError[] = []): ActionResult<never> {
  return { success: false, message, errors };
}
