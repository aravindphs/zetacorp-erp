/**
 * Structured application logger (spec §381).
 *
 * Emits single-line JSON so logs are queryable in production (Vercel/Datadog),
 * while staying readable in development. This is for *application* logs only —
 * business audit trails and user activity live in the database (audit_logs /
 * activity_logs), written via their dedicated services.
 */

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

type LogContext = Record<string, unknown>;

const isProd = process.env.NODE_ENV === 'production';

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = isProd ? JSON.stringify(entry) : formatPretty(level, message, context);

  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(line);
  } else if (level === 'WARNING') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function formatPretty(level: LogLevel, message: string, context?: LogContext): string {
  const suffix = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `[${level}] ${message}${suffix}`;
}

/** Serialise an unknown thrown value into a safe, structured shape for logs. */
export function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: isProd ? undefined : error.stack,
    };
  }
  return { error: String(error) };
}

export const logger = {
  info: (message: string, context?: LogContext) => write('INFO', message, context),
  warn: (message: string, context?: LogContext) => write('WARNING', message, context),
  error: (message: string, context?: LogContext) => write('ERROR', message, context),
  critical: (message: string, context?: LogContext) => write('CRITICAL', message, context),
};
