'use client';

/**
 * Create/edit customer form (spec §110, §111, §124). Client validation via RHF
 * + Zod; the server re-validates and enforces duplicate rules. On a duplicate
 * conflict the form surfaces a warning and, for privileged users, an override.
 */
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddressType, ContactMethod, CustomerStatus, CustomerType } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  customerFormSchema,
  type CustomerFormInput,
  type CustomerFormValues,
} from '@/features/customer/customer.schema';
import {
  createCustomerAction,
  updateCustomerAction,
} from '@/features/customer/customer.actions';
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
} from '@/features/customer/customer.types';

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

export function CustomerForm({
  mode,
  customerId,
  canOverride,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  customerId?: string;
  canOverride: boolean;
  defaultValues?: Partial<CustomerFormInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<CustomerFormInput, unknown, CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customerType: CustomerType.INDIVIDUAL,
      creditLimit: 0,
      useSameForShipping: true,
      ...defaultValues,
    },
  });

  const useSame = watch('useSameForShipping');

  const onSubmit: SubmitHandler<CustomerFormValues> = (values) => {
    startTransition(async () => {
      const override = duplicateWarning !== null && canOverride;
      const billing = values.billingAddress?.addressLine1
        ? { ...values.billingAddress, addressType: AddressType.BILLING }
        : undefined;
      const shipping =
        !values.useSameForShipping && values.shippingAddress?.addressLine1
          ? { ...values.shippingAddress, addressType: AddressType.SHIPPING }
          : undefined;

      const payload = {
        ...values,
        overrideDuplicates: override,
        billingAddress: billing,
        shippingAddress: shipping,
      };

      const result =
        mode === 'create'
          ? await createCustomerAction(payload)
          : await updateCustomerAction(customerId!, payload);

      if (result.success) {
        toast.success(result.message);
        router.push(mode === 'create' ? `/customers/${result.data.id}` : `/customers/${customerId}`);
        router.refresh();
        return;
      }

      const dupes = result.errors.filter((e) => e.code === 'DUPLICATE');
      if (dupes.length > 0) {
        setDuplicateWarning(dupes.map((d) => d.message).join(' '));
      }
      for (const err of result.errors) {
        if (err.field) setError(err.field as keyof CustomerFormValues, { message: err.message });
      }
      if (dupes.length === 0) toast.error(result.message);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {duplicateWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-500">Possible duplicate</p>
            <p className="text-muted-foreground">{duplicateWarning}</p>
            {canOverride && (
              <p className="mt-1 text-xs text-muted-foreground">
                You can save anyway — submit the form again to override.
              </p>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer type" required error={errors.customerType?.message}>
            <Controller
              control={control}
              name="customerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" {...register('companyName')} />
          </Field>
          <Field label="Customer name" htmlFor="customerName" required error={errors.customerName?.message}>
            <Input id="customerName" {...register('customerName')} />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>
          <Field label="Alternate phone" htmlFor="alternatePhone" error={errors.alternatePhone?.message}>
            <Input id="alternatePhone" {...register('alternatePhone')} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </Field>
          <Field label="Website" htmlFor="website" error={errors.website?.message}>
            <Input id="website" {...register('website')} />
          </Field>
          <Field label="GST number" htmlFor="gstNumber" error={errors.gstNumber?.message}>
            <Input id="gstNumber" className="uppercase" {...register('gstNumber')} />
          </Field>
          <Field label="PAN" htmlFor="panNumber" error={errors.panNumber?.message}>
            <Input id="panNumber" className="uppercase" {...register('panNumber')} />
          </Field>
          <Field label="Aadhaar" htmlFor="aadhaarNumber" error={errors.aadhaarNumber?.message}>
            <Input id="aadhaarNumber" {...register('aadhaarNumber')} />
          </Field>
          {mode === 'edit' && (
            <Field label="Status" error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value ?? CustomerStatus.ACTIVE} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="notes" rows={3} {...register('notes')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry" htmlFor="industry" error={errors.industry?.message}>
            <Input id="industry" {...register('industry')} />
          </Field>
          <Field label="Business size" htmlFor="businessSize" error={errors.businessSize?.message}>
            <Input id="businessSize" {...register('businessSize')} />
          </Field>
          <Field label="Payment terms (days)" htmlFor="paymentTermsDays" error={errors.paymentTermsDays?.message}>
            <Input id="paymentTermsDays" type="number" min={0} {...register('paymentTermsDays')} />
          </Field>
          <Field label="Credit limit (₹)" htmlFor="creditLimit" error={errors.creditLimit?.message}>
            <Input id="creditLimit" type="number" min={0} step="0.01" {...register('creditLimit')} />
          </Field>
          <Field label="Preferred contact" error={errors.preferredContactMethod?.message}>
            <Controller
              control={control}
              name="preferredContactMethod"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ContactMethod).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m.charAt(0) + m.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressFields prefix="billingAddress" register={register} errors={errors} legend="Billing address" />
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="useSameForShipping"
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              Shipping address is the same as billing
            </label>
            {!useSame && (
              <AddressFields prefix="shippingAddress" register={register} errors={errors} legend="Shipping address" />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {mode === 'create' ? 'Create customer' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AddressFields({
  prefix,
  register,
  errors,
  legend,
}: {
  prefix: 'billingAddress' | 'shippingAddress';
  register: any;
  errors: any;
  legend: string;
}) {
  const err = errors[prefix] ?? {};
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{legend}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" error={err.addressLine1?.message} className="sm:col-span-2">
          <Input {...register(`${prefix}.addressLine1`)} />
        </Field>
        <Field label="Address line 2" error={err.addressLine2?.message} className="sm:col-span-2">
          <Input {...register(`${prefix}.addressLine2`)} />
        </Field>
        <Field label="City" error={err.city?.message}>
          <Input {...register(`${prefix}.city`)} />
        </Field>
        <Field label="District" error={err.district?.message}>
          <Input {...register(`${prefix}.district`)} />
        </Field>
        <Field label="State" error={err.state?.message}>
          <Input {...register(`${prefix}.state`)} />
        </Field>
        <Field label="Postal code" error={err.postalCode?.message}>
          <Input {...register(`${prefix}.postalCode`)} />
        </Field>
      </div>
    </div>
  );
}
