'use client';

/**
 * Apply / edit leave (spec §277, §278). Duration is previewed client-side for
 * feedback but always recomputed on the server (§279).
 */
import { useMemo, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculateLeaveDays } from '@/features/leave/leave.calc';
import {
  applyLeaveSchema,
  type ApplyLeaveFormInput,
  type ApplyLeaveFormOutput,
} from '@/features/leave/leave.schema';
import { applyForLeaveAction, updateLeaveAction } from '@/features/leave/leave.actions';
import type { EmployeeOption } from '@/features/workforce/employee.types';

function Field({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const NONE = 'none';

export function ApplyLeaveForm({
  mode,
  leaveId,
  leaveTypes,
  colleagues,
  excludeWeekends,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  leaveId?: string;
  leaveTypes: { id: string; name: string }[];
  colleagues: EmployeeOption[];
  excludeWeekends: boolean;
  defaultValues?: Partial<ApplyLeaveFormInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplyLeaveFormInput, unknown, ApplyLeaveFormOutput>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: { isHalfDay: false, submit: true, ...defaultValues },
  });

  const err = errors as Record<string, { message?: string } | undefined>;
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const isHalfDay = watch('isHalfDay');

  // Mirrors the server calculation so the user sees the duration before saving.
  const previewDays = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
    return calculateLeaveDays(from, to, {
      excludeWeekends,
      isHalfDay: Boolean(isHalfDay),
    });
  }, [fromDate, toDate, isHalfDay, excludeWeekends]);

  const submitWith = (submit: boolean): SubmitHandler<ApplyLeaveFormOutput> => (values) => {
    startTransition(async () => {
      const payload = { ...values, submit };
      const result =
        mode === 'create'
          ? await applyForLeaveAction(payload)
          : await updateLeaveAction(leaveId as string, payload);

      if (result.success) {
        toast.success(result.message);
        router.push(`/workforce/leave/${result.data.id}`);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(submitWith(true))} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Leave type" required error={err.leaveTypeId?.message}>
            <Controller
              control={control}
              name="leaveTypeId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(leaveTypes.map((t) => [t.id, t.name]))}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="flex items-end">
            <Controller
              control={control}
              name="isHalfDay"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // A half day is a single date by definition (§278).
                      if (checked && fromDate) setValue('toDate', fromDate);
                    }}
                  />
                  Half day
                </label>
              )}
            />
          </div>

          <Field label="Start date" htmlFor="fromDate" required error={err.fromDate?.message}>
            <Input
              id="fromDate"
              type="date"
              {...register('fromDate', {
                onChange: (e) => {
                  if (isHalfDay) setValue('toDate', e.target.value);
                },
              })}
            />
          </Field>
          <Field label="End date" htmlFor="toDate" required error={err.toDate?.message}>
            <Input id="toDate" type="date" disabled={Boolean(isHalfDay)} {...register('toDate')} />
          </Field>

          <Field
            label="Reason"
            htmlFor="reason"
            required
            className="sm:col-span-2"
            error={err.reason?.message}
          >
            <Textarea id="reason" rows={3} {...register('reason')} />
          </Field>

          <Field
            label="Emergency contact"
            htmlFor="emergencyContact"
            error={err.emergencyContact?.message}
          >
            <Input id="emergencyContact" {...register('emergencyContact')} />
          </Field>

          <Field label="Delegate (optional)" error={err.delegateEmployeeId?.message}>
            <Controller
              control={control}
              name="delegateEmployeeId"
              render={({ field }) => (
                <Select
                  items={{
                    [NONE]: 'No delegate',
                    ...Object.fromEntries(colleagues.map((c) => [c.id, c.fullName])),
                  }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(!v || v === NONE ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select colleague" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No delegate</SelectItem>
                    {colleagues.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      {previewDays !== null && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarDays className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {previewDays} day{previewDays === 1 ? '' : 's'} of leave
              </p>
              <p className="text-xs text-muted-foreground">
                {excludeWeekends ? 'Weekends are excluded.' : 'Weekends are included.'} The server
                confirms this on save.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSubmit(submitWith(false))}
          disabled={isPending}
        >
          Save draft
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Submit for approval
        </Button>
      </div>
    </form>
  );
}
