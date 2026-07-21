'use client';

/**
 * Submit / edit an expense claim (spec §303, §304). Amount and dates are
 * re-validated server-side.
 */
import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  submitExpenseSchema,
  type ExpenseFormInput,
  type ExpenseFormOutput,
} from '@/features/expense/expense.schema';
import { createExpenseAction, updateExpenseAction } from '@/features/expense/expense.actions';

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

export function ExpenseForm({
  mode,
  expenseId,
  categories,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  expenseId?: string;
  categories: { id: string; name: string }[];
  defaultValues?: Partial<ExpenseFormInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(submitExpenseSchema),
    defaultValues: {
      currency: 'INR',
      submit: true,
      expenseDate: new Date().toISOString().slice(0, 10),
      ...defaultValues,
    },
  });

  const err = errors as Record<string, { message?: string } | undefined>;

  const submitWith =
    (submit: boolean): SubmitHandler<ExpenseFormOutput> =>
    (values) => {
      startTransition(async () => {
        const payload = { ...values, submit };
        const result =
          mode === 'create'
            ? await createExpenseAction(payload)
            : await updateExpenseAction(expenseId as string, payload);

        if (result.success) {
          toast.success(result.message);
          router.push(`/finance/expenses/${result.data.id}`);
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
          <CardTitle className="text-base">Expense information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required error={err.expenseCategoryId?.message}>
            <Controller
              control={control}
              name="expenseCategoryId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Expense date" htmlFor="expenseDate" required error={err.expenseDate?.message}>
            <Input id="expenseDate" type="date" {...register('expenseDate')} />
          </Field>

          <Field label="Amount" htmlFor="amount" required error={err.amount?.message}>
            <Input id="amount" type="number" step="0.01" min={0} {...register('amount')} />
          </Field>

          <Field label="Currency" htmlFor="currency" error={err.currency?.message}>
            <Input id="currency" maxLength={3} {...register('currency')} />
          </Field>

          <Field label="Vendor name" htmlFor="vendorName" error={err.vendorName?.message}>
            <Input id="vendorName" {...register('vendorName')} />
          </Field>

          <Field
            label="Reference number"
            htmlFor="referenceNumber"
            error={err.referenceNumber?.message}
          >
            <Input id="referenceNumber" {...register('referenceNumber')} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
            error={err.description?.message}
          >
            <Textarea id="description" rows={3} {...register('description')} />
          </Field>

          <Field
            label="Remarks"
            htmlFor="remarks"
            className="sm:col-span-2"
            error={err.remarks?.message}
          >
            <Textarea id="remarks" rows={2} {...register('remarks')} />
          </Field>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Save as a draft first if you need to attach receipts — they can be added from the claim
        page before it is decided.
      </p>

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
