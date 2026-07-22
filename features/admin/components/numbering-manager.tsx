'use client';

/**
 * Numbering sequences (spec §352). Changes affect only future records, and the
 * next number may never move backwards — the server enforces that too.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateNumberSequenceAction } from '@/features/admin/admin.actions';

interface Sequence {
  key: string;
  prefix: string;
  padding: number;
  nextValue: number;
}

function preview(prefix: string, padding: number, nextValue: number): string {
  return `${prefix}-${String(nextValue).padStart(padding, '0')}`;
}

export function NumberingManager({
  sequences,
  canManage,
}: {
  sequences: Sequence[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, Sequence>>(
    Object.fromEntries(sequences.map((s) => [s.key, { ...s }])),
  );

  function set(key: string, patch: Partial<Sequence>) {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));
  }

  function save(key: string) {
    const seq = draft[key];
    if (!seq) return;
    startTransition(async () => {
      const result = await updateNumberSequenceAction(seq);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (sequences.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        No sequences yet. They are created automatically the first time a record of each type is
        generated.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Sequence</th>
            <th className="px-3 py-2 font-medium">Prefix</th>
            <th className="px-3 py-2 font-medium">Padding</th>
            <th className="px-3 py-2 font-medium">Next number</th>
            <th className="px-3 py-2 font-medium">Preview</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {sequences.map((s) => {
            const d = draft[s.key] ?? s;
            const dirty =
              d.prefix !== s.prefix || d.padding !== s.padding || d.nextValue !== s.nextValue;
            return (
              <tr key={s.key}>
                <td className="px-3 py-2 font-mono text-xs">{s.key}</td>
                <td className="px-3 py-2">
                  <Input
                    className="h-8 w-32"
                    value={d.prefix}
                    disabled={!canManage}
                    onChange={(e) => set(s.key, { prefix: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    className="h-8 w-20"
                    type="number"
                    min={1}
                    max={12}
                    value={d.padding}
                    disabled={!canManage}
                    onChange={(e) => set(s.key, { padding: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    className="h-8 w-28"
                    type="number"
                    min={s.nextValue}
                    value={d.nextValue}
                    disabled={!canManage}
                    onChange={(e) => set(s.key, { nextValue: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {preview(d.prefix, d.padding, d.nextValue)}
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || !dirty}
                      onClick={() => save(s.key)}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
