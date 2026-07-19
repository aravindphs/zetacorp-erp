import 'server-only';

/**
 * Category business logic (spec §151). Soft delete only; a category with
 * products cannot be deleted.
 */
import { prisma } from '@/lib/prisma';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';
import type { CategoryInput } from '@/features/category/category.schema';

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

export async function listCategories(includeInactive = true): Promise<CategoryRow[]> {
  const rows = await prisma.category.findMany({
    where: { isDeleted: false, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      displayOrder: true,
      isActive: true,
      _count: { select: { products: { where: { isDeleted: false } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
    productCount: c._count.products,
  }));
}

async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, isDeleted: false, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new ConflictError('A category with this name already exists.');
}

export async function createCategory(user: AuthUser, input: CategoryInput) {
  await assertUniqueName(input.name);
  const category = await prisma.category.create({
    data: { ...input, ...auditCreate(user.id) },
  });
  await logActivity({ userId: user.id, activity: `Created category ${category.name}`, module: 'category', referenceId: category.id });
  return category;
}

export async function updateCategory(user: AuthUser, id: string, input: CategoryInput) {
  const existing = await prisma.category.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Category not found.');
  await assertUniqueName(input.name, id);
  const category = await prisma.category.update({
    where: { id },
    data: { ...input, ...auditUpdate(user.id) },
  });
  await logActivity({ userId: user.id, activity: `Updated category ${category.name}`, module: 'category', referenceId: id });
  return category;
}

export async function deleteCategory(user: AuthUser, id: string) {
  const existing = await prisma.category.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Category not found.');

  const productCount = await prisma.product.count({ where: { categoryId: id, isDeleted: false } });
  if (productCount > 0) {
    throw new BusinessRuleError('This category has products and cannot be deleted.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit({ userId: user.id, action: 'DELETE', module: 'category', referenceId: id, oldValue: { name: existing.name } }, tx);
  });
  await logActivity({ userId: user.id, activity: `Deleted category ${existing.name}`, module: 'category', referenceId: id });
}
