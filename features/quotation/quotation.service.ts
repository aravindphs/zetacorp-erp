import 'server-only';

/**
 * Quotation business logic (spec §171, §181, §185). Reuses the shared financial
 * engine; never affects inventory or payments (§185). Supports status
 * lifecycle, duplication, and conversion to an invoice.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { auditCreate } from '@/lib/db-helpers';
import { softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { CODE_PREFIX } from '@/constants/app';
import { calculateInvoice } from '@/features/invoice/invoice.calc';
import { createInvoice } from '@/features/invoice/invoice.service';
import type { CreateQuotationInput } from '@/features/quotation/quotation.schema';
import type { AuthUser } from '@/types/auth';
import type { QuotationStatus } from '@prisma/client';

function quotationNumberKey(date: Date) {
  const year = date.getFullYear();
  return { key: `quotation:${year}`, prefix: `${CODE_PREFIX.QUOTATION}-${year}` };
}

async function computeTotals(input: {
  items: CreateQuotationInput['items'];
  overallDiscount: number;
  placeOfSupply?: string;
}) {
  const companyState = await getSetting<string>('company.state', '');
  return calculateInvoice({
    lines: input.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      gstPercentage: i.gstPercentage,
    })),
    overallDiscount: input.overallDiscount,
    companyState,
    placeOfSupply: input.placeOfSupply,
  });
}

export async function createQuotation(user: AuthUser, input: CreateQuotationInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, isDeleted: false },
    select: { id: true, status: true },
  });
  if (!customer) throw new NotFoundError('Customer not found.');

  const totals = await computeTotals(input);
  const quotationDate = new Date(input.quotationDate);

  const quotation = await prisma.$transaction(async (tx) => {
    const { key, prefix } = quotationNumberKey(quotationDate);
    const number = await generateCode(tx, { key, prefix });
    const created = await tx.quotation.create({
      data: {
        quotationNumber: number,
        customerId: input.customerId,
        quotationDate,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        discount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        gstAmount: totals.gstAmount,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        placeOfSupply: input.placeOfSupply,
        referenceNumber: input.referenceNumber,
        remarks: input.remarks,
        termsConditions: input.termsConditions,
        ...auditCreate(user.id),
        items: {
          create: input.items.map((item, idx) => {
            const line = totals.lines[idx]!;
            return {
              productId: item.productId,
              productName: item.productName,
              description: item.description,
              hsnCode: item.hsnCode,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              gstPercentage: item.gstPercentage,
              taxableValue: line.taxableValue,
              gstAmount: line.gstAmount,
              lineTotal: line.lineTotal,
              sortOrder: idx,
            };
          }),
        },
      },
    });
    await logAudit(
      { userId: user.id, action: 'CREATE', module: 'quotation', referenceId: created.id, newValue: { quotationNumber: number } },
      tx,
    );
    return created;
  });

  await logActivity({ userId: user.id, activity: `Created quotation ${quotation.quotationNumber}`, module: 'quotation', referenceId: quotation.id });
  return quotation;
}

const ALLOWED_TRANSITIONS: Record<string, QuotationStatus[]> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
};

export async function changeQuotationStatus(user: AuthUser, id: string, status: QuotationStatus) {
  const quotation = await prisma.quotation.findFirst({ where: { id, isDeleted: false } });
  if (!quotation) throw new NotFoundError('Quotation not found.');
  const allowed = ALLOWED_TRANSITIONS[quotation.status] ?? [];
  if (!allowed.includes(status)) {
    throw new BusinessRuleError(`Cannot change status from ${quotation.status} to ${status}.`);
  }
  await prisma.quotation.update({
    where: { id },
    data: { status, updatedBy: user.id, ...(status === 'SENT' ? { sentAt: new Date() } : {}) },
  });
  await logActivity({ userId: user.id, activity: `Quotation ${quotation.quotationNumber} marked ${status}`, module: 'quotation', referenceId: id });
}

export async function cancelQuotation(user: AuthUser, id: string, reason: string) {
  const quotation = await prisma.quotation.findFirst({ where: { id, isDeleted: false } });
  if (!quotation) throw new NotFoundError('Quotation not found.');
  if (['CANCELLED', 'ACCEPTED'].includes(quotation.status)) {
    throw new BusinessRuleError(`A ${quotation.status.toLowerCase()} quotation cannot be cancelled.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, updatedBy: user.id },
    });
    await logAudit({ userId: user.id, action: 'QUOTATION_CANCEL', module: 'quotation', referenceId: id, oldValue: { quotationNumber: quotation.quotationNumber, reason } }, tx);
  });
  await logActivity({ userId: user.id, activity: `Cancelled quotation ${quotation.quotationNumber}`, module: 'quotation', referenceId: id });
}

export async function duplicateQuotation(user: AuthUser, id: string) {
  const source = await prisma.quotation.findFirst({
    where: { id, isDeleted: false },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!source) throw new NotFoundError('Quotation not found.');

  const quotationDate = new Date();
  const copy = await prisma.$transaction(async (tx) => {
    const { key, prefix } = quotationNumberKey(quotationDate);
    const number = await generateCode(tx, { key, prefix });
    return tx.quotation.create({
      data: {
        quotationNumber: number,
        customerId: source.customerId,
        quotationDate,
        validUntil: source.validUntil,
        status: 'DRAFT',
        subtotal: source.subtotal,
        discount: source.discount,
        taxableAmount: source.taxableAmount,
        cgstAmount: source.cgstAmount,
        sgstAmount: source.sgstAmount,
        igstAmount: source.igstAmount,
        gstAmount: source.gstAmount,
        roundOff: source.roundOff,
        grandTotal: source.grandTotal,
        placeOfSupply: source.placeOfSupply,
        termsConditions: source.termsConditions,
        remarks: source.remarks,
        duplicatedFromId: source.id,
        ...auditCreate(user.id),
        items: {
          create: source.items.map((it, idx) => ({
            productId: it.productId,
            productName: it.productName,
            description: it.description,
            hsnCode: it.hsnCode,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount,
            gstPercentage: it.gstPercentage,
            taxableValue: it.taxableValue,
            gstAmount: it.gstAmount,
            lineTotal: it.lineTotal,
            sortOrder: idx,
          })),
        },
      },
    });
  });
  await logActivity({ userId: user.id, activity: `Duplicated ${source.quotationNumber} → ${copy.quotationNumber}`, module: 'quotation', referenceId: copy.id });
  return copy;
}

/** Convert a quotation into a DRAFT invoice (spec §165 future → now). */
export async function convertQuotationToInvoice(user: AuthUser, id: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id, isDeleted: false },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!quotation) throw new NotFoundError('Quotation not found.');
  if (quotation.status === 'CANCELLED' || quotation.status === 'EXPIRED') {
    throw new BusinessRuleError('This quotation cannot be converted.');
  }

  const invoice = await createInvoice(user, {
    customerId: quotation.customerId,
    quotationId: quotation.id,
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: undefined,
    placeOfSupply: quotation.placeOfSupply ?? undefined,
    referenceNumber: quotation.referenceNumber ?? undefined,
    reverseCharge: false,
    overallDiscount: 0,
    notes: quotation.remarks ?? undefined,
    termsConditions: quotation.termsConditions ?? undefined,
    postNow: false,
    items: quotation.items.map((it) => ({
      productId: it.productId ?? undefined,
      productName: it.productName,
      description: it.description ?? undefined,
      hsnCode: it.hsnCode ?? undefined,
      unit: it.unit,
      quantity: it.quantity.toNumber(),
      unitPrice: it.unitPrice.toNumber(),
      discount: it.discount.toNumber(),
      gstPercentage: it.gstPercentage.toNumber(),
    })),
  });

  if (quotation.status !== 'ACCEPTED') {
    await prisma.quotation.update({ where: { id }, data: { status: 'ACCEPTED', updatedBy: user.id } });
  }
  await logActivity({ userId: user.id, activity: `Converted ${quotation.quotationNumber} to invoice`, module: 'quotation', referenceId: id });
  return invoice;
}

export async function deleteQuotation(user: AuthUser, id: string, reason: string) {
  const quotation = await prisma.quotation.findFirst({ where: { id, isDeleted: false } });
  if (!quotation) throw new NotFoundError('Quotation not found.');
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit({ userId: user.id, action: 'DELETE', module: 'quotation', referenceId: id, oldValue: { quotationNumber: quotation.quotationNumber, reason } }, tx);
  });
  await logActivity({ userId: user.id, activity: `Deleted quotation ${quotation.quotationNumber}`, module: 'quotation', referenceId: id });
}
