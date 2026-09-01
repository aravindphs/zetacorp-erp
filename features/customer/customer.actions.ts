'use server';

/**
 * Customer server actions (spec §127). Each verifies its permission, validates
 * input server-side, delegates to the service, and revalidates affected paths.
 */
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { deleteReasonSchema } from '@/schemas/common';
import {
  createCustomerSchema,
  customerNoteSchema,
  quickCustomerSchema,
  updateCustomerSchema,
} from '@/features/customer/customer.schema';
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from '@/features/customer/customer.service';
import {
  addCustomerNote,
  deleteCustomerNote,
} from '@/features/customer/customer.notes.service';
import { findDuplicates, type DuplicateMatch } from '@/features/customer/customer.repository';
import { importCustomers, type ImportReport } from '@/features/customer/customer.import';
import { parseCsv } from '@/utils/csv';

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.create');
    const data = createCustomerSchema.parse(input);
    const customer = await createCustomer(user, data);
    revalidatePath('/customers');
    return actionOk({ id: customer.id }, `Customer ${customer.customerCode} created.`);
  });
}

export interface QuickCustomerResult {
  id: string;
  name: string;
  code: string;
  /** Composed default address, for pre-filling the document's bill-to. */
  address: string;
}

/**
 * Create a customer inline from the invoice/quotation form and return enough
 * to add them to the picker and select them without a page reload.
 */
export async function quickCreateCustomerAction(
  input: unknown,
): Promise<ActionResult<QuickCustomerResult>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.create');
    const data = quickCustomerSchema.parse(input);

    const addr = data.billingAddress;
    const hasAddress = Boolean(addr?.addressLine1?.trim() && addr?.city?.trim());

    const customer = await createCustomer(user, {
      ...data,
      overrideDuplicates: true,
      useSameForShipping: false,
      billingAddress:
        hasAddress && addr
          ? {
              addressType: 'BILLING',
              addressLine1: addr.addressLine1 ?? '',
              addressLine2: addr.addressLine2 || undefined,
              city: addr.city ?? '',
              district: addr.district || undefined,
              state: addr.state ?? '',
              country: addr.country?.trim() || 'India',
              postalCode: addr.postalCode ?? '',
              isDefault: true,
            }
          : undefined,
    });

    revalidatePath('/customers');

    const address = hasAddress && addr
      ? [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.postalCode]
          .map((p) => p?.trim())
          .filter(Boolean)
          .join(', ')
      : '';

    return actionOk(
      { id: customer.id, name: customer.customerName, code: customer.customerCode, address },
      `Customer ${customer.customerCode} created.`,
    );
  });
}

export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.update');
    const data = updateCustomerSchema.parse(input);
    const customer = await updateCustomer(user, id, data);
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return actionOk({ id: customer.id }, 'Customer updated.');
  });
}

export async function deleteCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.delete');
    const { reason } = deleteReasonSchema.parse(input);
    await deleteCustomer(user, id, reason);
    revalidatePath('/customers');
    return actionOk(null, 'Customer deleted.');
  });
}

/** Live duplicate check for the form (spec §124). */
export async function checkCustomerDuplicatesAction(input: {
  phone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  excludeId?: string;
}): Promise<ActionResult<DuplicateMatch[]>> {
  return handleAction(async () => {
    await requirePermission('customer.create');
    const matches = await findDuplicates(
      { phone: input.phone, email: input.email, gstNumber: input.gstNumber, panNumber: input.panNumber },
      input.excludeId,
    );
    return actionOk(matches);
  });
}

export async function importCustomersAction(csv: string): Promise<ActionResult<ImportReport>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.import');
    const records = parseCsv(csv);
    const report = await importCustomers(user, records);
    revalidatePath('/customers');
    return actionOk(report, `Imported ${report.imported} of ${report.total} rows.`);
  });
}

export async function addCustomerNoteAction(
  customerId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.notes');
    const { content } = customerNoteSchema.parse(input);
    const note = await addCustomerNote(user, customerId, content);
    revalidatePath(`/customers/${customerId}`);
    return actionOk({ id: note.id }, 'Note added.');
  });
}

export async function deleteCustomerNoteAction(
  noteId: string,
  customerId: string,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('customer.notes');
    await deleteCustomerNote(user, noteId);
    revalidatePath(`/customers/${customerId}`);
    return actionOk(null, 'Note deleted.');
  });
}
