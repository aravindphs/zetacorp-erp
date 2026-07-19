'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import {
  cancelInvoiceSchema,
  createInvoiceSchema,
  recordPaymentSchema,
} from '@/features/invoice/invoice.schema';
import {
  cancelInvoice,
  createInvoice,
  postInvoice,
  recordPayment,
} from '@/features/invoice/invoice.service';

export async function createInvoiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('invoice.create');
    const data = createInvoiceSchema.parse(input);
    const invoice = await createInvoice(user, data);
    revalidatePath('/invoices');
    return actionOk({ id: invoice.id }, `Invoice ${invoice.invoiceNumber} created.`);
  });
}

export async function postInvoiceAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('invoice.post');
    await postInvoice(user, id);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return actionOk(null, 'Invoice posted. Stock updated.');
  });
}

export async function cancelInvoiceAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('invoice.cancel');
    const { reason } = cancelInvoiceSchema.parse(input);
    await cancelInvoice(user, id, reason);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return actionOk(null, 'Invoice cancelled. Stock restored.');
  });
}

export async function recordPaymentAction(
  invoiceId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('payment.create');
    const data = recordPaymentSchema.parse(input);
    const payment = await recordPayment(user, invoiceId, data);
    revalidatePath(`/invoices/${invoiceId}`);
    return actionOk({ id: payment.id }, 'Payment recorded.');
  });
}
