import 'server-only';

/**
 * Invoice business logic (spec §201–§210). Server-authoritative money,
 * inventory integration on post/cancel, and payment-driven status. Financial
 * fields are immutable once posted (§210) — editing a posted invoice is not
 * allowed; use cancellation.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { applyStockMovement } from '@/services/stock.service';
import { auditCreate } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { recordFinancialTransaction } from '@/services/financial-transaction.service';
import { getSetting } from '@/features/settings/settings.cache';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import { CODE_PREFIX } from '@/constants/app';
import {
  calculateContractInvoice,
  calculateInvoice,
  derivePaymentStatus,
} from '@/features/invoice/invoice.calc';
import { defaultInvoiceNotes } from '@/features/invoice/invoice.pdf-data';
import type { CreateInvoiceInput, RecordPaymentInput } from '@/features/invoice/invoice.schema';
import type { AuthUser } from '@/types/auth';

function invoiceNumberKey(date: Date) {
  const year = date.getFullYear();
  return { key: `invoice:${year}`, prefix: `${CODE_PREFIX.INVOICE}-${year}` };
}

/**
 * Server-authoritative totals. Contract-billed invoices back-calculate the
 * taxable split from the agreed (GST-inclusive) contract value; itemized
 * invoices sum their product lines as before.
 */
async function computeTotals(input: CreateInvoiceInput) {
  const companyState = await getSetting<string>('company.state', '');

  if (input.billingType !== 'ITEMIZED') {
    const contract = calculateContractInvoice({
      contractValue: input.contractValue ?? 0,
      isTaxInclusive: input.isTaxInclusive,
      billingType: input.billingType,
      goodsRatio: input.goodsRatio,
      goodsGstPercentage: input.goodsGstPercentage,
      serviceGstPercentage: input.serviceGstPercentage,
      companyState,
      placeOfSupply: input.placeOfSupply,
    });

    // Additional product lines are billed ON TOP of the contract value, each
    // taxed at its own rate.
    const extras = calculateInvoice({
      lines: input.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        gstPercentage: i.gstPercentage,
      })),
      companyState,
      placeOfSupply: input.placeOfSupply,
    });

    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const taxableAmount = r2(contract.taxableAmount + extras.taxableAmount);
    const gstAmount = r2(contract.gstAmount + extras.gstAmount);
    const cgstAmount = r2(contract.cgstAmount + extras.cgstAmount);
    const sgstAmount = r2(contract.sgstAmount + extras.sgstAmount);
    const igstAmount = r2(contract.igstAmount + extras.igstAmount);

    return {
      lines: extras.lines,
      subtotal: taxableAmount,
      totalDiscount: extras.totalDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstAmount,
      roundOff: contract.roundOff,
      grandTotal: r2(contract.grandTotal + extras.taxableAmount + extras.gstAmount),
      isInterState: contract.isInterState,
    };
  }

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

/** Deduct stock for every product line and mark the invoice POSTED (§203). */
async function postWithinTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string,
): Promise<void> {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId },
    include: { items: true },
  });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status !== 'DRAFT') throw new BusinessRuleError('Only draft invoices can be posted.');

  const stockLines = invoice.items.filter((i) => i.productId);
  if (stockLines.length > 0) {
    const products = await tx.product.findMany({
      where: { id: { in: stockLines.map((i) => i.productId as string) } },
      select: { id: true, productName: true, currentStock: true, status: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Aggregate demand per product (a product may appear on multiple lines).
    const demand = new Map<string, number>();
    for (const line of stockLines) {
      const pid = line.productId as string;
      demand.set(pid, (demand.get(pid) ?? 0) + line.quantity.toNumber());
    }
    for (const [pid, qty] of demand) {
      const product = byId.get(pid);
      if (!product) throw new BusinessRuleError('A product on this invoice no longer exists.');
      if (product.currentStock.toNumber() < qty) {
        throw new BusinessRuleError(
          `Insufficient stock for ${product.productName}: need ${qty}, have ${product.currentStock.toNumber()}.`,
        );
      }
    }
    for (const [pid, qty] of demand) {
      await applyStockMovement(tx, {
        productId: pid,
        type: 'SALE',
        delta: -qty,
        referenceType: 'invoice',
        referenceId: invoiceId,
        remarks: `Invoice ${invoice.invoiceNumber}`,
        userId,
      });
    }
  }

  const paymentStatus = derivePaymentStatus(
    invoice.grandTotal.toNumber(),
    invoice.amountPaid.toNumber(),
    invoice.dueDate,
  );

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: 'POSTED', postedAt: new Date(), paymentStatus, updatedBy: userId },
  });

  // Posting is the point revenue is recognised, so it books a ledger entry
  // (Financial Engine, §311). Same transaction — the ledger cannot drift.
  await recordFinancialTransaction(tx, {
    type: 'INVOICE_POSTED',
    debit: invoice.grandTotal,
    customerId: invoice.customerId,
    invoiceId,
    reference: invoice.invoiceNumber,
    userId,
    occurredAt: invoice.invoiceDate,
  });

  await logAudit(
    { userId, action: 'INVOICE_POST', module: 'invoice', referenceId: invoiceId, newValue: { invoiceNumber: invoice.invoiceNumber } },
    tx,
  );
}

export async function createInvoice(user: AuthUser, input: CreateInvoiceInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, isDeleted: false },
    select: { id: true, status: true, customerName: true },
  });
  if (!customer) throw new NotFoundError('Customer not found.');
  if (customer.status === 'BLACKLISTED') {
    throw new BusinessRuleError('This customer is blacklisted and cannot be invoiced.');
  }

  const totals = await computeTotals(input);
  const invoiceDate = new Date(input.invoiceDate);
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  const invoice = await prisma.$transaction(async (tx) => {
    // A manually entered invoice number wins (e.g. a specific series like
    // "ZCS/2026-27/001"); otherwise the year sequence generates one. The DB
    // unique constraint guards against duplicates and surfaces as a conflict.
    const manualNumber = input.invoiceNumber?.trim();
    const { key, prefix } = invoiceNumberKey(invoiceDate);
    const number = manualNumber || (await generateCode(tx, { key, prefix }));

    const created = await tx.invoice.create({
      data: {
        invoiceNumber: number,
        customerId: input.customerId,
        quotationId: input.quotationId,
        invoiceDate,
        dueDate,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        subtotal: totals.subtotal,
        discount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        gstAmount: totals.gstAmount,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        amountPaid: 0,
        balanceDue: totals.grandTotal,
        placeOfSupply: input.placeOfSupply,
        referenceNumber: input.referenceNumber,
        reverseCharge: input.reverseCharge,
        // Pre-fill the standard notes block when none was supplied, so the PDF
        // carries the template boilerplate with live figures.
        notes:
          input.notes ??
          (input.billingType === 'ITEMIZED'
            ? undefined
            : defaultInvoiceNotes({
                goodsRatio: input.billingType === 'SPLIT' ? input.goodsRatio : 100,
                serviceRatio: input.billingType === 'SPLIT' ? 100 - input.goodsRatio : 0,
                goodsGst: input.goodsGstPercentage,
                serviceGst: input.serviceGstPercentage,
                goodsHsn: input.goodsHsnCode ?? '8541',
                serviceSac: input.serviceSacCode ?? '9954',
                grandTotal: totals.grandTotal,
                isInterState: totals.isInterState,
                placeOfSupply: input.placeOfSupply,
              })),
        termsConditions: input.termsConditions,
        billingType: input.billingType,
        isTaxInclusive: input.isTaxInclusive,
        contractValue: input.contractValue,
        goodsRatio: input.goodsRatio,
        goodsGstPercentage: input.goodsGstPercentage,
        serviceGstPercentage: input.serviceGstPercentage,
        goodsHsnCode: input.goodsHsnCode,
        serviceSacCode: input.serviceSacCode,
        goodsDescription: input.goodsDescription,
        serviceDescription: input.serviceDescription,
        billingAddress: input.billingAddress,
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
      { userId: user.id, action: 'CREATE', module: 'invoice', referenceId: created.id, newValue: { invoiceNumber: number, grandTotal: totals.grandTotal } },
      tx,
    );

    if (input.postNow) await postWithinTx(tx, created.id, user.id);
    return created;
  });

  await logActivity({ userId: user.id, activity: `Created invoice ${invoice.invoiceNumber}`, module: 'invoice', referenceId: invoice.id });
  return invoice;
}

export async function postInvoice(user: AuthUser, id: string) {
  await prisma.$transaction((tx) => postWithinTx(tx, id, user.id));
  await logActivity({ userId: user.id, activity: `Posted invoice`, module: 'invoice', referenceId: id });
}

export async function cancelInvoice(user: AuthUser, id: string, reason: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id, isDeleted: false }, include: { items: true } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status === 'CANCELLED') throw new ConflictError('Invoice is already cancelled.');
  if (invoice.status !== 'POSTED') throw new BusinessRuleError('Only posted invoices can be cancelled.');

  await prisma.$transaction(async (tx) => {
    // Restore stock for each product line (spec §209).
    const demand = new Map<string, number>();
    for (const line of invoice.items) {
      if (!line.productId) continue;
      demand.set(line.productId, (demand.get(line.productId) ?? 0) + line.quantity.toNumber());
    }
    for (const [pid, qty] of demand) {
      await applyStockMovement(tx, {
        productId: pid,
        type: 'RETURN',
        delta: qty,
        referenceType: 'invoice_cancel',
        referenceId: id,
        remarks: `Cancelled invoice ${invoice.invoiceNumber}`,
        userId: user.id,
      });
    }
    await tx.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, updatedBy: user.id },
    });

    // The ledger is append-only, so cancelling posts a reversing entry rather
    // than deleting the original — otherwise the cancelled invoice would keep
    // inflating the customer balance and revenue reports (§311).
    await recordFinancialTransaction(tx, {
      type: 'CREDIT_NOTE',
      credit: invoice.grandTotal,
      customerId: invoice.customerId,
      invoiceId: id,
      reference: `Cancelled ${invoice.invoiceNumber}`,
      userId: user.id,
    });

    await logAudit(
      { userId: user.id, action: 'INVOICE_CANCEL', module: 'invoice', referenceId: id, oldValue: { invoiceNumber: invoice.invoiceNumber, reason } },
      tx,
    );
  });

  await logActivity({ userId: user.id, activity: `Cancelled invoice ${invoice.invoiceNumber}`, module: 'invoice', referenceId: id });
}

export async function recordPayment(user: AuthUser, invoiceId: string, input: RecordPaymentInput) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, isDeleted: false } });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  if (invoice.status !== 'POSTED') throw new BusinessRuleError('Payments can only be recorded on posted invoices.');

  const balanceDue = invoice.balanceDue.toNumber();
  if (input.amount > balanceDue + 0.01) {
    throw new BusinessRuleError(`Amount exceeds the outstanding balance of ${balanceDue}.`);
  }

  const payment = await prisma.$transaction(async (tx) => {
    const payYear = new Date(input.paymentDate).getFullYear();
    const number = await generateCode(tx, {
      key: `payment:${payYear}`,
      prefix: `${CODE_PREFIX.PAYMENT}-${payYear}`,
    });
    const created = await tx.payment.create({
      data: {
        paymentNumber: number,
        invoiceId,
        customerId: invoice.customerId,
        paymentDate: new Date(input.paymentDate),
        paymentMethod: input.paymentMethod,
        status: 'SUCCESS',
        referenceNumber: input.referenceNumber,
        amount: input.amount,
        remarks: input.remarks,
        ...auditCreate(user.id),
      },
    });

    // Recompute paid/outstanding/status from all successful payments (§204, §206).
    const agg = await tx.payment.aggregate({
      where: { invoiceId, isDeleted: false, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const amountPaid = agg._sum.amount?.toNumber() ?? 0;
    const grandTotal = invoice.grandTotal.toNumber();
    const newBalance = Number((grandTotal - amountPaid).toFixed(2));
    const paymentStatus = derivePaymentStatus(grandTotal, amountPaid, invoice.dueDate);

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, balanceDue: newBalance, paymentStatus, updatedBy: user.id },
    });

    // Money in — book the matching ledger entry (Financial Engine, §311).
    await recordFinancialTransaction(tx, {
      type: 'PAYMENT_RECEIVED',
      credit: created.amount,
      customerId: invoice.customerId,
      invoiceId,
      paymentId: created.id,
      reference: created.paymentNumber,
      userId: user.id,
      occurredAt: created.paymentDate,
    });

    return created;
  });

  await logActivity({ userId: user.id, activity: `Recorded payment ${payment.paymentNumber} on invoice ${invoice.invoiceNumber}`, module: 'payment', referenceId: invoiceId });
  return payment;
}
