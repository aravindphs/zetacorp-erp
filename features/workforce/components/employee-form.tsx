'use client';

/**
 * Create/edit employee form (spec §250, §251, §254). Client validation with
 * RHF+Zod; the server re-validates, generates the employee code (§246) and
 * provisions the Supabase Auth account.
 */
import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmploymentType, Gender, MaritalStatus, UserStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  employeeFormSchema,
  type EmployeeFormInput,
  type EmployeeFormOutput,
} from '@/features/workforce/employee.schema';
import {
  createEmployeeAction,
  updateEmployeeAction,
} from '@/features/workforce/employee.actions';
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  type EmployeeOption,
} from '@/features/workforce/employee.types';

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

/** Wraps an optional select so "none" maps to undefined. */
function optionalValue(v: string | null): string | undefined {
  return !v || v === NONE ? undefined : v;
}

export function EmployeeForm({
  mode,
  employeeId,
  departments,
  designations,
  roles,
  managers,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  employeeId?: string;
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  managers: EmployeeOption[];
  defaultValues?: Partial<EmployeeFormInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormInput, unknown, EmployeeFormOutput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      status: UserStatus.ACTIVE,
      nationality: 'Indian',
      ...defaultValues,
    },
  });

  const err = errors as Record<string, { message?: string } | undefined>;

  const onSubmit: SubmitHandler<EmployeeFormOutput> = (values) => {
    // Password is only collected on create; enforce it here because the shared
    // client schema keeps it optional (§259).
    if (mode === 'create' && !values.password) {
      setError('password', { message: 'An initial password is required.' });
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createEmployeeAction(values)
          : await updateEmployeeAction(employeeId as string, values);

      if (result.success) {
        toast.success(result.message);
        router.push(
          mode === 'create' ? `/workforce/employees/${result.data.id}` : `/workforce/employees/${employeeId}`,
        );
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal information (§250) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required error={err.firstName?.message}>
            <Input id="firstName" {...register('firstName')} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={err.lastName?.message}>
            <Input id="lastName" {...register('lastName')} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>
          <Field
            label="Alternate phone"
            htmlFor="alternatePhone"
            error={err.alternatePhone?.message}
          >
            <Input id="alternatePhone" {...register('alternatePhone')} />
          </Field>
          <Field label="Gender" error={err.gender?.message}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  items={{ [NONE]: 'Not specified', ...GENDER_LABELS }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(optionalValue(v as string | null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {Object.entries(GENDER_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Date of birth" htmlFor="dateOfBirth" error={err.dateOfBirth?.message}>
            <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          </Field>
          <Field label="Blood group" htmlFor="bloodGroup" error={err.bloodGroup?.message}>
            <Input id="bloodGroup" placeholder="e.g. O+" {...register('bloodGroup')} />
          </Field>
          <Field label="Nationality" htmlFor="nationality" error={err.nationality?.message}>
            <Input id="nationality" {...register('nationality')} />
          </Field>
          <Field label="Marital status" error={err.maritalStatus?.message}>
            <Controller
              control={control}
              name="maritalStatus"
              render={({ field }) => (
                <Select
                  items={{ [NONE]: 'Not specified', ...MARITAL_STATUS_LABELS }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(optionalValue(v as string | null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {Object.entries(MARITAL_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Emergency contact name"
            htmlFor="emergencyContactName"
            error={err.emergencyContactName?.message}
          >
            <Input id="emergencyContactName" {...register('emergencyContactName')} />
          </Field>
          <Field
            label="Emergency contact phone"
            htmlFor="emergencyContactPhone"
            error={err.emergencyContactPhone?.message}
          >
            <Input id="emergencyContactPhone" {...register('emergencyContactPhone')} />
          </Field>
          <Field
            label="Address line 1"
            htmlFor="addressLine1"
            className="sm:col-span-2"
            error={err.addressLine1?.message}
          >
            <Input id="addressLine1" {...register('addressLine1')} />
          </Field>
          <Field
            label="Address line 2"
            htmlFor="addressLine2"
            className="sm:col-span-2"
            error={err.addressLine2?.message}
          >
            <Input id="addressLine2" {...register('addressLine2')} />
          </Field>
          <Field label="City" htmlFor="city" error={err.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>
          <Field label="State" htmlFor="state" error={err.state?.message}>
            <Input id="state" {...register('state')} />
          </Field>
          <Field label="Postal code" htmlFor="postalCode" error={err.postalCode?.message}>
            <Input id="postalCode" {...register('postalCode')} />
          </Field>
        </CardContent>
      </Card>

      {/* Employment information (§251) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" required error={err.departmentId?.message}>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(departments.map((d) => [d.id, d.name]))}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Designation" error={err.designationId?.message}>
            <Controller
              control={control}
              name="designationId"
              render={({ field }) => (
                <Select
                  items={{
                    [NONE]: 'Not assigned',
                    ...Object.fromEntries(designations.map((d) => [d.id, d.name])),
                  }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(optionalValue(v as string | null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not assigned</SelectItem>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Joining date" htmlFor="joiningDate" required error={err.joiningDate?.message}>
            <Input id="joiningDate" type="date" {...register('joiningDate')} />
          </Field>
          <Field
            label="Probation end date"
            htmlFor="probationEndDate"
            error={err.probationEndDate?.message}
          >
            <Input id="probationEndDate" type="date" {...register('probationEndDate')} />
          </Field>
          <Field label="Employment type" error={err.employmentType?.message}>
            <Controller
              control={control}
              name="employmentType"
              render={({ field }) => (
                <Select
                  items={{ [NONE]: 'Not specified', ...EMPLOYMENT_TYPE_LABELS }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(optionalValue(v as string | null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Reporting manager" error={err.reportingManagerId?.message}>
            <Controller
              control={control}
              name="reportingManagerId"
              render={({ field }) => (
                <Select
                  items={{
                    [NONE]: 'None',
                    ...Object.fromEntries(managers.map((m) => [m.id, m.fullName])),
                  }}
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(optionalValue(v as string | null))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {managers
                      .filter((m) => m.id !== employeeId)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName} ({m.employeeCode})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Work location" htmlFor="workLocation" error={err.workLocation?.message}>
            <Input id="workLocation" {...register('workLocation')} />
          </Field>
        </CardContent>
      </Card>

      {/* User account (§254) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Email (login)" htmlFor="email" required error={err.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </Field>
          <Field label="Role" required error={err.roleId?.message}>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Status" error={err.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  items={EMPLOYEE_STATUS_LABELS}
                  value={field.value ?? UserStatus.ACTIVE}
                  onValueChange={(v) => field.onChange((v as UserStatus) ?? UserStatus.ACTIVE)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {mode === 'create' && (
            <Field
              label="Initial password"
              htmlFor="password"
              required
              error={err.password?.message}
            >
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              <p className="text-xs text-muted-foreground">
                At least 12 characters with upper, lower, number and symbol.
              </p>
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {mode === 'create' ? 'Create employee' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
