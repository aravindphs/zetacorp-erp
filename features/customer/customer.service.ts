import 'server-only';

/**
 * Customer business logic (spec §61 — service layer owns all rules). Handles
 * code generation, duplicate detection/override, transactional writes, and
 * audit/activity logging. HTTP concerns stay in the route/action layer.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logAudit } from '@/services/audit-log.service';
import { logActivity } from '@/services/activity-log.service';
import { hasPermission } from '@/lib/auth/guards';
import { ConflictError, NotFoundError, BusinessRuleError } from '@/lib/errors';
import { buildPaginationMeta } from '@/lib/pagination';
import { CODE_PREFIX } from '@/constants/app';
import type { AuthUser } from '@/types/auth';
import type { ApiError } from '@/types/api';
import type {
  AddressInput,
  CreateCustomerInput,
  CustomerListQuery,
  UpdateCustomerInput,
} from '@/features/customer/customer.schema';
import {
  countActiveInvoices,
  findDuplicates,
  getCustomerDetail,
  listCustomers,
  outstandingByCustomer,
  type DuplicateMatch,
} from '@/features/customer/customer.repository';

const DUP_FIELD_LABEL: Record<DuplicateMatch['field'], string> = {
  phone: 'phone number',
  email: 'email',
  gstNumber: 'GST number',
  panNumber: 'PAN',
};

/** GST/PAN collisions are never allowed; phone/email may be overridden by a
 *  privileged user (spec §111, §124, §128). */
async function assertNoBlockingDuplicates(
  user: AuthUser,
  fields: { phone?: string; email?: string; gstNumber?: string; panNumber?: string },
  override: boolean,
  excludeId?: string,
): Promise<void> {
  const matches = await findDuplicates(fields, excludeId);
  if (matches.length === 0) return;

  const canOverride = override && hasPermission(user, 'customer.delete');
  const blocking = matches.filter((m) => {
    if (m.field === 'gstNumber' || m.field === 'panNumber') return true; // hard-unique
    return !canOverride; // phone/email overridable by privileged users
  });
  if (blocking.length === 0) return;

  const errors: ApiError[] = blocking.map((m) => ({
    field: m.field === 'gstNumber' ? 'gstNumber' : m.field === 'panNumber' ? 'panNumber' : m.field,
    message: `${m.customerName} (${m.customerCode}) already uses this ${DUP_FIELD_LABEL[m.field]}.`,
    code: 'DUPLICATE',
  }));
  throw new ConflictError('A customer with these details already exists.', errors);
}

function toAddressCreate(
  address: AddressInput,
  fallbackType: AddressInput['addressType'],
  userId: string,
): Prisma.CustomerAddressCreateWithoutCustomerInput {
  return {
    addressType: address.addressType ?? fallbackType,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    district: address.district,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
    isDefault: true,
    createdBy: userId,
    updatedBy: userId,
  };
}

export async function getCustomerList(query: CustomerListQuery) {
  const { items, total } = await listCustomers(query);
  const outstanding = await outstandingByCustomer(items.map((c) => c.id));

  const rows = items.map((c) => ({
    id: c.id,
    customerCode: c.customerCode,
    customerName: c.customerName,
    companyName: c.companyName,
    phone: c.phone,
    gstNumber: c.gstNumber,
    customerType: c.customerType,
    status: c.status,
    city: c.addresses[0]?.city ?? null,
    outstanding: outstanding.get(c.id) ?? 0,
    createdAt: c.createdAt.toISOString(),
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export async function createCustomer(user: AuthUser, input: CreateCustomerInput) {
  await assertNoBlockingDuplicates(
    user,
    { phone: input.phone, email: input.email, gstNumber: input.gstNumber, panNumber: input.panNumber },
    input.overrideDuplicates,
  );

  const addresses: Prisma.CustomerAddressCreateWithoutCustomerInput[] = [];
  if (input.billingAddress) {
    addresses.push(toAddressCreate(input.billingAddress, 'BILLING', user.id));
    const shipping = input.useSameForShipping
      ? { ...input.billingAddress, addressType: 'SHIPPING' as const }
      : input.shippingAddress;
    if (shipping) addresses.push(toAddressCreate(shipping, 'SHIPPING', user.id));
  }

  const customer = await prisma.$transaction(async (tx) => {
    const code = await generateCode(tx, { key: 'customer', prefix: CODE_PREFIX.CUSTOMER });
    const created = await tx.customer.create({
      data: {
        customerCode: code,
        customerType: input.customerType,
        companyName: input.companyName,
        customerName: input.customerName,
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        email: input.email,
        website: input.website,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
        aadhaarNumber: input.aadhaarNumber,
        notes: input.notes,
        industry: input.industry,
        businessSize: input.businessSize,
        paymentTermsDays: input.paymentTermsDays,
        creditLimit: input.creditLimit,
        preferredContactMethod: input.preferredContactMethod,
        ...auditCreate(user.id),
        ...(addresses.length ? { addresses: { create: addresses } } : {}),
      },
    });
    await logAudit(
      { userId: user.id, action: 'CREATE', module: 'customer', referenceId: created.id, newValue: { customerCode: code, customerName: created.customerName } },
      tx,
    );
    return created;
  });

  await logActivity({
    userId: user.id,
    activity: `Created customer ${customer.customerCode}`,
    module: 'customer',
    referenceId: customer.id,
  });

  return customer;
}

export async function updateCustomer(user: AuthUser, id: string, input: UpdateCustomerInput) {
  const existing = await prisma.customer.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Customer not found.');

  await assertNoBlockingDuplicates(
    user,
    { phone: input.phone, email: input.email, gstNumber: input.gstNumber, panNumber: input.panNumber },
    input.overrideDuplicates,
    id,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.customer.update({
      where: { id },
      data: {
        customerType: input.customerType,
        companyName: input.companyName,
        customerName: input.customerName,
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        email: input.email,
        website: input.website,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
        aadhaarNumber: input.aadhaarNumber,
        notes: input.notes,
        industry: input.industry,
        businessSize: input.businessSize,
        paymentTermsDays: input.paymentTermsDays,
        creditLimit: input.creditLimit,
        preferredContactMethod: input.preferredContactMethod,
        ...(input.status ? { status: input.status } : {}),
        ...auditUpdate(user.id),
      },
    });
    await logAudit(
      {
        userId: user.id,
        action: 'UPDATE',
        module: 'customer',
        referenceId: id,
        oldValue: { customerName: existing.customerName, phone: existing.phone, status: existing.status },
        newValue: { customerName: row.customerName, phone: row.phone, status: row.status },
      },
      tx,
    );
    return row;
  });

  await logActivity({
    userId: user.id,
    activity: `Updated customer ${updated.customerCode}`,
    module: 'customer',
    referenceId: id,
  });

  return updated;
}

export async function deleteCustomer(user: AuthUser, id: string, reason: string) {
  const existing = await prisma.customer.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Customer not found.');

  // Business rule §128: cannot delete a customer that has invoices.
  const invoiceCount = await countActiveInvoices(id);
  if (invoiceCount > 0) {
    throw new BusinessRuleError(
      'This customer has invoices and cannot be deleted. Archive the customer instead.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit(
      { userId: user.id, action: 'DELETE', module: 'customer', referenceId: id, oldValue: { customerCode: existing.customerCode, reason } },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Deleted customer ${existing.customerCode} (${reason})`,
    module: 'customer',
    referenceId: id,
  });
}

export async function getCustomerProfileOrThrow(id: string) {
  const customer = await getCustomerDetail(id);
  if (!customer) throw new NotFoundError('Customer not found.');
  return customer;
}
