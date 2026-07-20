'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { deleteReasonSchema } from '@/schemas/common';
import {
  cancelQuotationSchema,
  createQuotationSchema,
  quotationStatusSchema,
} from '@/features/quotation/quotation.schema';
import {
  cancelQuotation,
  changeQuotationStatus,
  convertQuotationToInvoice,
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
} from '@/features/quotation/quotation.service';

export async function createQuotationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.create');
    const data = createQuotationSchema.parse(input);
    const quotation = await createQuotation(user, data);
    revalidatePath('/quotations');
    return actionOk({ id: quotation.id }, `Quotation ${quotation.quotationNumber} created.`);
  });
}

export async function changeQuotationStatusAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.update');
    const { status } = quotationStatusSchema.parse(input);
    await changeQuotationStatus(user, id, status);
    revalidatePath(`/quotations/${id}`);
    revalidatePath('/quotations');
    return actionOk(null, `Marked ${status.toLowerCase()}.`);
  });
}

export async function cancelQuotationAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.cancel');
    const { reason } = cancelQuotationSchema.parse(input);
    await cancelQuotation(user, id, reason);
    revalidatePath(`/quotations/${id}`);
    revalidatePath('/quotations');
    return actionOk(null, 'Quotation cancelled.');
  });
}

export async function duplicateQuotationAction(id: string): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.duplicate');
    const copy = await duplicateQuotation(user, id);
    revalidatePath('/quotations');
    return actionOk({ id: copy.id }, `Duplicated to ${copy.quotationNumber}.`);
  });
}

export async function convertQuotationAction(id: string): Promise<ActionResult<{ invoiceId: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.convert');
    const invoice = await convertQuotationToInvoice(user, id);
    revalidatePath('/invoices');
    revalidatePath(`/quotations/${id}`);
    return actionOk({ invoiceId: invoice.id }, `Created invoice ${invoice.invoiceNumber}.`);
  });
}

export async function deleteQuotationAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('quotation.delete');
    const { reason } = deleteReasonSchema.parse(input);
    await deleteQuotation(user, id, reason);
    revalidatePath('/quotations');
    return actionOk(null, 'Quotation deleted.');
  });
}
