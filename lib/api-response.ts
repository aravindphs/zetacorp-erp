/**
 * Consistent API responses (spec §63, §380) and a route-handler wrapper that
 * centralises validation, error mapping, and logging so individual routes stay
 * thin (spec §61 — no business logic in the HTTP layer).
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { ApiError, ApiFailure, ApiSuccess, PaginationMeta } from '@/types/api';
import { AppError, isAppError, normalizeDatabaseError, ValidationError } from '@/lib/errors';
import { HttpStatus, type HttpStatusCode } from '@/lib/http-status';
import { logger, serializeError } from '@/lib/logger';

function newRequestId(): string {
  return crypto.randomUUID();
}

interface SuccessInit {
  message?: string;
  status?: HttpStatusCode;
  meta?: PaginationMeta;
  requestId?: string;
}

/** Build a success envelope response. */
export function apiSuccess<TData>(
  data: TData,
  init: SuccessInit = {},
): NextResponse<ApiSuccess<TData>> {
  const body: ApiSuccess<TData> = {
    success: true,
    message: init.message ?? 'OK',
    data,
    ...(init.meta ? { meta: init.meta } : {}),
    timestamp: new Date().toISOString(),
    requestId: init.requestId ?? newRequestId(),
  };
  return NextResponse.json(body, { status: init.status ?? HttpStatus.OK });
}

/** Build a failure envelope response. */
export function apiFailure(
  message: string,
  status: HttpStatusCode,
  errors: ApiError[] = [],
  requestId: string = newRequestId(),
): NextResponse<ApiFailure> {
  const body: ApiFailure = {
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    requestId,
  };
  return NextResponse.json(body, { status });
}

/** Convert a ZodError into the flat field-error shape used by the API. */
export function zodToApiErrors(error: ZodError): ApiError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Map any thrown value to a failure response. Known application errors surface
 * their message; unknown errors are logged and returned as a generic 500 so
 * that internal details never leak (spec §65).
 */
export function toErrorResponse(rawError: unknown, requestId: string = newRequestId()): NextResponse {
  // Surface database constraint failures as actionable messages (§65).
  const error = normalizeDatabaseError(rawError);
  if (error instanceof ZodError) {
    return apiFailure(
      'The submitted data is invalid.',
      HttpStatus.BAD_REQUEST,
      zodToApiErrors(error),
      requestId,
    );
  }
  if (isAppError(error)) {
    if (error.status >= 500) {
      logger.error(`AppError ${error.code}`, { requestId, ...serializeError(error) });
    }
    return apiFailure(error.message, error.status, error.errors, requestId);
  }
  logger.error('Unhandled route error', { requestId, ...serializeError(error) });
  return apiFailure(
    'Something went wrong. Please try again.',
    HttpStatus.INTERNAL_ERROR,
    [],
    requestId,
  );
}

/**
 * Wrap a route handler so thrown `AppError`s and `ZodError`s become consistent
 * responses and unexpected errors are logged. Every request gets a requestId.
 */
export function withApiHandler<TArgs extends unknown[]>(
  handler: (request: Request, requestId: string, ...args: TArgs) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: TArgs): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') ?? newRequestId();
    const startedAt = Date.now();
    try {
      return await handler(request, requestId, ...args);
    } catch (error) {
      return toErrorResponse(error, requestId);
    } finally {
      logger.info('request', {
        requestId,
        method: request.method,
        url: new URL(request.url).pathname,
        durationMs: Date.now() - startedAt,
      });
    }
  };
}

/** Assert a Zod-parsed result or throw a ValidationError with field details. */
export { AppError, ValidationError };
