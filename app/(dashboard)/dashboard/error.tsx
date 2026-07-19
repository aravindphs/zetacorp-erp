'use client';

/**
 * Dashboard route error boundary (spec §98). Shows a friendly, retryable
 * message and never surfaces raw server errors.
 */
import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/page-states';
import { logger, serializeError } from '@/lib/logger';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Dashboard route error', { digest: error.digest, ...serializeError(error) });
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title="Unable to load dashboard"
        description="We couldn't load your dashboard just now. Please try again."
        onRetry={reset}
      />
    </div>
  );
}
