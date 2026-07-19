'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { importCustomersAction } from '@/features/customer/customer.actions';
import type { ImportReport } from '@/features/customer/customer.import';

const TEMPLATE = 'Customer Name,Phone,Company,Email,GST,PAN,City,State,Type\n';

export function ImportCustomers() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isPending, startTransition] = useTransition();

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function runImport() {
    if (!file) return;
    startTransition(async () => {
      const csv = await file.text();
      const result = await importCustomersAction(csv);
      if (result.success) {
        setReport(result.data);
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import from CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a CSV with columns: <code>Customer Name</code>, <code>Phone</code>,{' '}
          <code>Company</code>, <code>Email</code>, <code>GST</code>, <code>PAN</code>,{' '}
          <code>City</code>, <code>State</code>, <code>Type</code>. Duplicates (by phone, email, or
          GST) are skipped.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
          />
          <Button onClick={runImport} disabled={!file || isPending} size="sm">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            Download template
          </Button>
        </div>

        {report && (
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap gap-6">
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="size-4" /> {report.imported} imported
              </span>
              <span className="text-muted-foreground">{report.skipped} skipped (duplicates)</span>
              <span className={report.errors.length ? 'text-destructive' : 'text-muted-foreground'}>
                {report.errors.length} invalid
              </span>
              <span className="text-muted-foreground">{report.total} total rows</span>
            </div>
            {report.errors.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {report.errors.map((err) => (
                  <li key={err.row} className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
