import type { ProductStatus } from '@prisma/client';

export interface ProductRow {
  id: string;
  productCode: string;
  productName: string;
  brand: string | null;
  category: string;
  unit: string;
  sellingPrice: number;
  gstPercentage: number;
  currentStock: number;
  minimumStock: number;
  lowStock: boolean;
  status: ProductStatus;
}
