'use client';

/**
 * Create/edit product form (spec §141, §142). Client validation with RHF+Zod;
 * server re-validates and generates the code + opening-stock transaction.
 */
import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProductStatus } from '@prisma/client';
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
import { PRODUCT_STATUS_LABELS, PRODUCT_UNITS } from '@/constants/inventory';
import {
  createProductSchema,
  type CreateProductFormInput,
  type CreateProductInput,
} from '@/features/inventory/product.schema';
import { createProductAction, updateProductAction } from '@/features/inventory/product.actions';

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

export function ProductForm({
  mode,
  productId,
  categories,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  productId?: string;
  categories: { id: string; name: string }[];
  defaultValues?: Partial<CreateProductFormInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProductFormInput, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      gstPercentage: 0,
      unit: 'Nos',
      purchasePrice: 0,
      sellingPrice: 0,
      discountPercentage: 0,
      minimumStock: 0,
      openingStock: 0,
      status: ProductStatus.ACTIVE,
      ...defaultValues,
    },
  });

  const err = errors as Record<string, { message?: string } | undefined>;

  const onSubmit: SubmitHandler<CreateProductInput> = (values) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createProductAction(values)
          : await updateProductAction(productId!, values);
      if (result.success) {
        toast.success(result.message);
        router.push(mode === 'create' ? `/inventory/${result.data.id}` : `/inventory/${productId}`);
        router.refresh();
      } else {
        toast.error(result.message);
        for (const e of result.errors) if (e.field) toast.error(e.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="productName" required error={err.productName?.message}>
            <Input id="productName" {...register('productName')} />
          </Field>
          <Field label="Category" required error={err.categoryId?.message}>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
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
          <Field label="Brand" htmlFor="brand" error={err.brand?.message}>
            <Input id="brand" {...register('brand')} />
          </Field>
          <Field label="Model" htmlFor="model" error={err.model?.message}>
            <Input id="model" {...register('model')} />
          </Field>
          <Field label="SKU" htmlFor="sku" error={err.sku?.message}>
            <Input id="sku" {...register('sku')} />
          </Field>
          <Field label="HSN code" htmlFor="hsnCode" error={err.hsnCode?.message}>
            <Input id="hsnCode" {...register('hsnCode')} />
          </Field>
          <Field label="GST %" htmlFor="gstPercentage" required error={err.gstPercentage?.message}>
            <Input id="gstPercentage" type="number" step="0.01" min={0} max={28} {...register('gstPercentage')} />
          </Field>
          <Field label="Unit" error={err.unit?.message}>
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Description" htmlFor="description" error={err.description?.message} className="sm:col-span-2">
            <Textarea id="description" rows={2} {...register('description')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Purchase price (₹)" htmlFor="purchasePrice" error={err.purchasePrice?.message}>
            <Input id="purchasePrice" type="number" step="0.01" min={0} {...register('purchasePrice')} />
          </Field>
          <Field label="Selling price (₹)" htmlFor="sellingPrice" error={err.sellingPrice?.message}>
            <Input id="sellingPrice" type="number" step="0.01" min={0} {...register('sellingPrice')} />
          </Field>
          <Field label="MRP (₹)" htmlFor="mrp" error={err.mrp?.message}>
            <Input id="mrp" type="number" step="0.01" min={0} {...register('mrp')} />
          </Field>
          <Field label="Default discount %" htmlFor="discountPercentage" error={err.discountPercentage?.message}>
            <Input id="discountPercentage" type="number" step="0.01" min={0} max={100} {...register('discountPercentage')} />
          </Field>
          <Field label="Min selling price (₹)" htmlFor="minimumSellingPrice" error={err.minimumSellingPrice?.message}>
            <Input id="minimumSellingPrice" type="number" step="0.01" min={0} {...register('minimumSellingPrice')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {mode === 'create' && (
            <Field label="Opening stock" htmlFor="openingStock" error={err.openingStock?.message}>
              <Input id="openingStock" type="number" step="0.001" min={0} {...register('openingStock')} />
            </Field>
          )}
          <Field label="Minimum stock" htmlFor="minimumStock" error={err.minimumStock?.message}>
            <Input id="minimumStock" type="number" step="0.001" min={0} {...register('minimumStock')} />
          </Field>
          <Field label="Maximum stock" htmlFor="maximumStock" error={err.maximumStock?.message}>
            <Input id="maximumStock" type="number" step="0.001" min={0} {...register('maximumStock')} />
          </Field>
          <Field label="Reorder level" htmlFor="reorderLevel" error={err.reorderLevel?.message}>
            <Input id="reorderLevel" type="number" step="0.001" min={0} {...register('reorderLevel')} />
          </Field>
          <Field label="Status" error={err.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
