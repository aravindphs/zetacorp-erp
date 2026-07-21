import 'server-only';

/**
 * Expense category catalogue (spec §301). Admin-managed and unbounded; soft
 * delete only, and a category still used by claims cannot be removed.
 */
import { prisma } from '@/lib/prisma';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expenseCount: number;
}

export interface ExpenseCategoryInput {
  name: string;
  description?: string;
  isActive: boolean;
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  const rows = await prisma.expenseCategory.findMany({
    where: { isDeleted: false },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { expenses: { where: { isDeleted: false } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    expenseCount: c._count.expenses,
  }));
}

async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.expenseCategory.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError('A category with this name already exists.');
}

export async function createExpenseCategory(user: AuthUser, input: ExpenseCategoryInput) {
  await assertUniqueName(input.name);
  const category = await prisma.expenseCategory.create({
    data: { ...input, ...auditCreate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Created expense category ${category.name}`,
    module: 'expense',
    referenceId: category.id,
  });
  return category;
}

export async function updateExpenseCategory(
  user: AuthUser,
  id: string,
  input: ExpenseCategoryInput,
) {
  const existing = await prisma.expenseCategory.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Category not found.');
  await assertUniqueName(input.name, id);

  const category = await prisma.expenseCategory.update({
    where: { id },
    data: { ...input, ...auditUpdate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Updated expense category ${category.name}`,
    module: 'expense',
    referenceId: id,
  });
  return category;
}

export async function deleteExpenseCategory(user: AuthUser, id: string) {
  const existing = await prisma.expenseCategory.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Category not found.');

  const count = await prisma.expense.count({ where: { expenseCategoryId: id, isDeleted: false } });
  if (count > 0) {
    throw new BusinessRuleError('This category is used by existing expenses and cannot be deleted.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.expenseCategory.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit(
      { userId: user.id, action: 'DELETE', module: 'expense', referenceId: id, oldValue: { name: existing.name } },
      tx,
    );
  });
  await logActivity({
    userId: user.id,
    activity: `Deleted expense category ${existing.name}`,
    module: 'expense',
    referenceId: id,
  });
}
