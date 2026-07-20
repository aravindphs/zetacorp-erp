'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { uuidSchema } from '@/schemas/common';
import { ValidationError } from '@/lib/errors';
import {
  deleteEmployeeDocument,
  getDocumentDownloadUrl,
  parseDocumentType,
  uploadEmployeeDocument,
} from '@/features/workforce/document.service';

/**
 * Uploads a document. Takes FormData because it carries a File — server actions
 * stream multipart bodies directly, so no separate upload endpoint is needed.
 */
export async function uploadEmployeeDocumentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.documents');

    const employeeId = uuidSchema.parse(formData.get('employeeId'));
    const documentType = parseDocumentType(formData.get('documentType'));
    const remarks = (formData.get('remarks') as string | null) ?? undefined;
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ValidationError('Select a file to upload.');

    const document = await uploadEmployeeDocument(user, {
      employeeId,
      documentType,
      file,
      remarks: remarks || undefined,
    });

    revalidatePath(`/workforce/employees/${employeeId}`);
    return actionOk({ id: document.id }, 'Document uploaded.');
  });
}

export async function getDocumentUrlAction(documentId: string): Promise<ActionResult<{ url: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.documents');
    const url = await getDocumentDownloadUrl(user, uuidSchema.parse(documentId));
    return actionOk({ url }, 'Link ready.');
  });
}

export async function deleteEmployeeDocumentAction(
  documentId: string,
  employeeId: string,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.documents');
    await deleteEmployeeDocument(user, uuidSchema.parse(documentId));
    revalidatePath(`/workforce/employees/${employeeId}`);
    return actionOk(null, 'Document deleted.');
  });
}
