/**
 * Audit logging (spec §17, §40, §45, §75).
 *
 * Records immutable, security-sensitive actions (deletes, role changes,
 * settings changes, backup restores…) with before/after snapshots. Audit logs
 * are append-only and must never be edited (spec §40).
 *
 * Unlike activity logs, an audit write failure on a sensitive action is
 * significant — callers perform the audit write inside the same transaction as
 * the mutation where atomicity is required (see repository/service usage).
 */
import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface AuditInput {
  userId: string | null;
  action: string;
  module: string;
  referenceId?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

/** Prisma client or an interactive transaction client. */
type Db = Pick<typeof prisma, 'auditLog'> | Prisma.TransactionClient;

export async function logAudit(input: AuditInput, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      module: input.module,
      referenceId: input.referenceId ?? null,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
