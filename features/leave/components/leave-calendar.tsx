'use client';

/**
 * Monthly leave calendar (spec §282). Pure presentation over a pre-fetched
 * month; navigation is a URL change so the server re-queries a bounded window.
 */
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LEAVE_STATUS_CLASSES, type LeaveCalendarEntry } from '@/features/leave/leave.types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toUtcDay(value: string): number {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function LeaveCalendar({
  entries,
  month,
  year,
}: {
  entries: LeaveCalendarEntry[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = useCallback(
    (deltaMonths: number) => {
      const next = new URLSearchParams(searchParams.toString());
      const target = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
      next.set('month', String(target.getUTCMonth() + 1));
      next.set('year', String(target.getUTCFullYear()));
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, month, year],
  );

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first offset.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  function entriesForDay(day: number): LeaveCalendarEntry[] {
    const ts = Date.UTC(year, month - 1, day);
    return entries.filter((e) => toUtcDay(e.fromDate) <= ts && ts <= toUtcDay(e.toDate));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => go(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(0)}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => go(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px] rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dayEntries = day ? entriesForDay(day) : [];
              return (
                <div
                  key={i}
                  className="min-h-[92px] border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0"
                >
                  {day && (
                    <>
                      <p className="mb-1 text-xs text-muted-foreground">{day}</p>
                      <div className="space-y-1">
                        {dayEntries.slice(0, 3).map((e) => (
                          <Badge
                            key={e.id}
                            variant="secondary"
                            className={`block w-full truncate text-[10px] ${LEAVE_STATUS_CLASSES[e.status]}`}
                            title={`${e.employeeName} — ${e.leaveTypeName}`}
                          >
                            {e.employeeName}
                          </Badge>
                        ))}
                        {dayEntries.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{dayEntries.length - 3} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
