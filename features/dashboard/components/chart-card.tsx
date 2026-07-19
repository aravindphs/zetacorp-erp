import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Card wrapper for a dashboard chart, with a built-in empty state (spec §97). */
export function ChartCard({
  title,
  action,
  isEmpty,
  emptyLabel = 'No data to display yet.',
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div
            className={cn(
              'flex h-[260px] items-center justify-center text-sm text-muted-foreground',
            )}
          >
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
