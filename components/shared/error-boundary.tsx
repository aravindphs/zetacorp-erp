'use client';

/**
 * Minimal error boundary (React has no built-in component form). Wrap around a
 * Suspense section so a failed widget shows a friendly, retryable state instead
 * of taking down the whole page (spec §98).
 */
import { Component, type ReactNode } from 'react';
import { ErrorState } from '@/components/shared/page-states';
import { logger, serializeError } from '@/lib/logger';

interface Props {
  children: ReactNode;
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    logger.error('Section render error', serializeError(error));
  }

  private readonly reset = () => this.setState({ hasError: false });

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.title ?? 'Unable to load this section'}
          description={this.props.description}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
