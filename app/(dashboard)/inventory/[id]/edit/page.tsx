import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { listCategories } from '@/features/category/category.service';
import { getProductById } from '@/features/inventory/product.repository';
import { ProductForm } from '@/features/inventory/components/product-form';
import type { CreateProductFormInput } from '@/features/inventory/product.schema';

export const metadata: Metadata = { title: 'Edit Product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('inventory.update');
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id),
    listCategories(false),
  ]);
  if (!product) notFound();

  const defaultValues: Partial<CreateProductFormInput> = {
    productName: product.productName,
    categoryId: product.categoryId,
    brand: product.brand ?? undefined,
    model: product.model ?? undefined,
    description: product.description ?? undefined,
    sku: product.sku ?? undefined,
    hsnCode: product.hsnCode ?? undefined,
    gstPercentage: product.gstPercentage.toNumber(),
    unit: product.unit as CreateProductFormInput['unit'],
    purchasePrice: product.purchasePrice.toNumber(),
    sellingPrice: product.sellingPrice.toNumber(),
    discountPercentage: product.discountPercentage.toNumber(),
    minimumSellingPrice: product.minimumSellingPrice?.toNumber(),
    mrp: product.mrp?.toNumber(),
    minimumStock: product.minimumStock.toNumber(),
    maximumStock: product.maximumStock?.toNumber(),
    reorderLevel: product.reorderLevel?.toNumber(),
    status: product.status,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={`Edit ${product.productName}`} description={product.productCode} />
      <ProductForm
        mode="edit"
        productId={product.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultValues={defaultValues}
      />
    </div>
  );
}
