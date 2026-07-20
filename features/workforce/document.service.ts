import 'server-only';

/**
 * Employee documents (spec §255, §262, §267). Files live in a private Storage
 * bucket; only the object path is persisted. Type and size are enforced server
 * side, and a failed database write rolls the uploaded object back so storage
 * never keeps an orphan (§267 "rollback upload").
 */
import { EmployeeDocumentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auditCreate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { BusinessRuleError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  createSignedUrl,
  removeFile,
  sanitizeFileName,
  uploadFile,
} from '@/services/storage.service';
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_MAX_BYTES,
} from '@/features/workforce/employee.types';
import type { AuthUser } from '@/types/auth';

export interface UploadDocumentInput {
  employeeId: string;
  documentType: EmployeeDocumentType;
  file: File;
  remarks?: string;
}

export async function uploadEmployeeDocument(user: AuthUser, input: UploadDocumentInput) {
  const employee = await prisma.user.findFirst({
    where: { id: input.employeeId, isDeleted: false },
    select: { id: true, employeeCode: true },
  });
  if (!employee) throw new NotFoundError('Employee not found.');

  const { file } = input;
  if (!file || file.size === 0) throw new ValidationError('Select a file to upload.');
  if (file.size > DOCUMENT_MAX_BYTES) {
    throw new ValidationError('File is larger than the 10 MB limit.');
  }
  if (!DOCUMENT_ALLOWED_MIME.includes(file.type as (typeof DOCUMENT_ALLOWED_MIME)[number])) {
    throw new ValidationError('Only PDF, PNG, JPG and JPEG files are allowed.');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `employee-documents/${employee.id}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  await uploadFile(storagePath, bytes, file.type);

  try {
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.employeeDocument.create({
        data: {
          employeeId: employee.id,
          documentType: input.documentType,
          fileName: safeName,
          storagePath,
          mimeType: file.type,
          fileSize: file.size,
          remarks: input.remarks,
          ...auditCreate(user.id),
        },
      });
      await logAudit(
        {
          userId: user.id,
          action: 'CREATE',
          module: 'employee_document',
          referenceId: created.id,
          newValue: { employeeCode: employee.employeeCode, fileName: safeName },
        },
        tx,
      );
      return created;
    });

    await logActivity({
      userId: user.id,
      activity: `Uploaded document ${safeName} for ${employee.employeeCode}`,
      module: 'employee',
      referenceId: employee.id,
    });
    return document;
  } catch (error) {
    // Roll the object back so a failed insert leaves nothing behind (§267).
    await removeFile(storagePath).catch(() => undefined);
    throw error;
  }
}

export function listEmployeeDocuments(employeeId: string) {
  return prisma.employeeDocument.findMany({
    where: { employeeId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
}

/** Short-lived download link for one document (§255). */
export async function getDocumentDownloadUrl(user: AuthUser, documentId: string): Promise<string> {
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, isDeleted: false },
    select: { id: true, storagePath: true, fileName: true, employeeId: true },
  });
  if (!document) throw new NotFoundError('Document not found.');

  const url = await createSignedUrl(document.storagePath);
  await logActivity({
    userId: user.id,
    activity: `Downloaded document ${document.fileName}`,
    module: 'employee',
    referenceId: document.employeeId,
  });
  return url;
}

export async function deleteEmployeeDocument(user: AuthUser, documentId: string) {
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, isDeleted: false },
    select: { id: true, fileName: true, storagePath: true, employeeId: true },
  });
  if (!document) throw new NotFoundError('Document not found.');

  await prisma.$transaction(async (tx) => {
    await tx.employeeDocument.update({ where: { id: documentId }, data: { ...softDelete(user.id) } });
    await logAudit(
      {
        userId: user.id,
        action: 'DELETE',
        module: 'employee_document',
        referenceId: documentId,
        oldValue: { fileName: document.fileName },
      },
      tx,
    );
  });

  // Best-effort object cleanup; the record is already soft-deleted either way.
  await removeFile(document.storagePath).catch(() => undefined);
  await logActivity({
    userId: user.id,
    activity: `Deleted document ${document.fileName}`,
    module: 'employee',
    referenceId: document.employeeId,
  });
}

/** Guard used by the upload action to validate the incoming enum value. */
export function parseDocumentType(value: unknown): EmployeeDocumentType {
  if (typeof value === 'string' && value in EmployeeDocumentType) {
    return value as EmployeeDocumentType;
  }
  throw new BusinessRuleError('Select a valid document type.');
}
