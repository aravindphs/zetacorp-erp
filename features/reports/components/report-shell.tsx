'use client';

/**
 * Shared report chrome (spec §322, §333, §341): date-range filtering, KPI
 * cards, a simple breakdown table, and a print/export bar. Report pages compose
 * these so every report behaves the same way.
 */
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/page-states';

/** Date range + a clear control, shared by every report (§322). */
export function ReportRangeFilter({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const hasFilters = [...searchParams.keys()].length > 0;

  return (
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <div className="space-y-1">
        <Label htmlFor="rep-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="rep-from"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('fromDate') ?? ''}
          onChange={(e) => setParam('fromDate', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rep-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="rep-to"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('toDate') ?? ''}
          onChange={(e) => setParam('toDate', e.target.value || null)}
        />
      </div>

      {children}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
          <X className="size-4" /> Reset filters
        </Button>
      )}
    </div>
  );
}

/**
 * Print + CSV export controls (§322, §335). `report` names which report to
 * export so the request never depends on the Referer header.
 */
export function ReportActions({ report, canExport }: { report: string; canExport: boolean }) {
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
      {canExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('report', report);
            window.location.href = `/api/reports/export?${params.toString()}`;
          }}
        >
          <Download className="size-4" /> Export CSV
        </Button>
      )}
    </div>
  );
}

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

/** KPI card row (§333). */
export function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums">{k.value}</p>
            {k.hint && <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Simple breakdown table used by most reports. */
export function BreakdownTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold">{title}</h2>
        <EmptyState
          title="No records found for the selected filters."
          description="Try widening the date range."
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {columns.map((c, i) => (
                <th key={c} className={`px-3 py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 ${ci > 0 ? 'text-right tabular-nums' : 'font-medium'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
