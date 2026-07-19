/**
 * Application error hierarchy (spec §65).
 *
 * Services and repositories throw these typed errors; the API layer maps them
 * to the correct HTTP status and a user-safe message. Raw errors (SQL, stack
 * traces, internal details) are never exposed to the client.
 */
import type { ApiError } from '@/types/api';
import { HttpStatus, type HttpStatusCode } from '@/lib/http-status';

export abstract class AppError extends Error {
  abstract readonly status: HttpStatusCode;
  /** Stable machine code, e.g. "NOT_FOUND", "VALIDATION_ERROR". */
  abstract readonly code: string;
  /** Field-level errors, when relevant (validation, conflicts). */
  readonly errors: ApiError[];

  constructor(message: string, errors: ApiError[] = []) {
    super(message);
    this.name = new.target.name;
    this.errors = errors;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 — malformed request / schema validation failure. */
export class ValidationError extends AppError {
  readonly status = HttpStatus.BAD_REQUEST;
  readonly code = 'VALIDATION_ERROR';
  constructor(message = 'The submitted data is invalid.', errors: ApiError[] = []) {
    super(message, errors);
  }
}

/** 401 — no valid session. */
export class UnauthenticatedError extends AppError {
  readonly status = HttpStatus.UNAUTHENTICATED;
  readonly code = 'UNAUTHENTICATED';
  constructor(message = 'You must be signed in to perform this action.') {
    super(message);
  }
}

/** 403 — authenticated but lacks the required permission/ownership. */
export class ForbiddenError extends AppError {
  readonly status = HttpStatus.FORBIDDEN;
  readonly code = 'FORBIDDEN';
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
  }
}

/** 404 — record does not exist (or is soft-deleted and hidden from the caller). */
export class NotFoundError extends AppError {
  readonly status = HttpStatus.NOT_FOUND;
  readonly code = 'NOT_FOUND';
  constructor(message = 'The requested resource was not found.') {
    super(message);
  }
}

/** 409 — uniqueness/state conflict (e.g. duplicate email). */
export class ConflictError extends AppError {
  readonly status = HttpStatus.CONFLICT;
  readonly code = 'CONFLICT';
  constructor(message = 'This action conflicts with existing data.', errors: ApiError[] = []) {
    super(message, errors);
  }
}

/** 422 — request is well-formed but violates a business rule. */
export class BusinessRuleError extends AppError {
  readonly status = HttpStatus.UNPROCESSABLE;
  readonly code = 'BUSINESS_RULE_VIOLATION';
  constructor(message: string, errors: ApiError[] = []) {
    super(message, errors);
  }
}

/** 429 — rate limit exceeded (spec §67). */
export class RateLimitError extends AppError {
  readonly status = HttpStatus.TOO_MANY_REQUESTS;
  readonly code = 'RATE_LIMITED';
  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
  }
}

/** Type guard for the application error hierarchy. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
