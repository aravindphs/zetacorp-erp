/**
 * Standard page/section states (spec §11, §97, §98): loading, empty, error, and
 * permission-denied. Reused by every module so states look consistent.
 */
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StateShellProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
  tone?: 'default' | 'destructive';
}

function StateShell({
  icon: Icon,
  title,
  description,
  className,
  children,
  tone = 'default',
}: StateShellProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center',
        className,
      )}
      role={tone === 'destructive' ? 'alert' : undefined}
    >
      <div
        className={cn(
          'mb-4 flex size-12 items-center justify-center rounded-full',
          tone === 'destructive'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon = Inbox,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <StateShell icon={icon} title={title} description={description} className={className}>
      {action}
    </StateShell>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem persists, contact your administrator.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <StateShell
      icon={AlertCircle}
      title={title}
      description={description}
      tone="destructive"
      className={className}
    >
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </StateShell>
  );
}

export function PermissionDenied({
  title = 'Permission denied',
  description = 'You do not have permission to view this page. Contact your administrator if you believe this is a mistake.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return <StateShell icon={Lock} title={title} description={description} className={className} />;
}

/** Generic list/table loading skeleton. */
export function LoadingState({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
