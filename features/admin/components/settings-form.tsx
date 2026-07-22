'use client';

/**
 * Generic settings panel (spec §349–§351, §357, §363). Each admin section
 * declares its fields and the action that saves them, so every panel behaves
 * identically without duplicating form plumbing.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ActionResult } from '@/types/action';

export interface SettingField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'switch' | 'email';
  placeholder?: string;
  hint?: string;
  /** Render across the full width instead of one column. */
  wide?: boolean;
}

export function SettingsForm({
  title,
  description,
  fields,
  initialValues,
  action,
  canManage,
}: {
  title: string;
  description?: string;
  fields: SettingField[];
  initialValues: Record<string, unknown>;
  action: (input: unknown) => Promise<ActionResult<null>>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  function set(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await action(values);
      if (result.success) {
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
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.name];
          const id = `set-${field.name}`;

          if (field.type === 'switch') {
            return (
              <label
                key={field.name}
                className={`flex items-center gap-2 text-sm ${field.wide ? 'sm:col-span-2' : ''}`}
              >
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={(v) => set(field.name, v)}
                  disabled={!canManage}
                />
                {field.label}
              </label>
            );
          }

          return (
            <div
              key={field.name}
              className={`space-y-2 ${field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}`}
            >
              <Label htmlFor={id}>{field.label}</Label>
              {field.type === 'textarea' ? (
                <Textarea
                  id={id}
                  rows={2}
                  value={String(value ?? '')}
                  placeholder={field.placeholder}
                  disabled={!canManage}
                  onChange={(e) => set(field.name, e.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                  value={String(value ?? '')}
                  placeholder={field.placeholder}
                  disabled={!canManage}
                  onChange={(e) =>
                    set(
                      field.name,
                      field.type === 'number' ? Number(e.target.value) : e.target.value,
                    )
                  }
                />
              )}
              {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
            </div>
          );
        })}

        {canManage && (
          <div className="flex justify-end sm:col-span-2">
            <Button onClick={save} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
