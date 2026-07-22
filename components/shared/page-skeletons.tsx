/**
 * Route-level loading skeletons (spec §265, §290, §314, §341).
 *
 * Next.js renders these instantly while a server component fetches, so a
 * navigation gives immediate feedback instead of leaving the previous page
 * frozen for the duration of the round-trip.
 */
import { Skeleton } from '@/components/ui/skeleton';

function HeaderSkeleton({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withActions && (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}
    </div>
  );
}

/** List page: header, filter bar, table. */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[150px]" />
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Dashboard-style page: header, KPI cards, then content. */
export function StatsPageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </div>
  );
}

/** Detail page: title block, summary cards, two detail panels. */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Form page: header then stacked field cards. */
export function FormPageSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-live="polite">
      <HeaderSkeleton withActions={false} />
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="space-y-4 rounded-lg border p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
