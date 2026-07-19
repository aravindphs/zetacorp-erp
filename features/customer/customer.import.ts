import 'server-only';

/**
 * Customer CSV import (spec §125). Validates every row, detects duplicates
 * against existing data, and inserts the valid, non-duplicate rows inside a
 * single transaction so a failure rolls back the whole batch.
 */
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { auditCreate } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { CODE_PREFIX } from '@/constants/app';
import { CustomerType } from '@prisma/client';
import { emailSchema, gstSchema, nonEmptyString, panSchema, phoneSchema } from '@/schemas/common';
import type { AuthUser } from '@/types/auth';

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional().or(z.literal('').transform(() => undefined));

const importRowSchema = z.object({
  customerName: nonEmptyString(150),
  phone: phoneSchema,
  companyName: optional(nonEmptyString(200)),
  email: optional(emailSchema),
  gstNumber: optional(gstSchema),
  panNumber: optional(panSchema),
  city: optional(nonEmptyString(100)),
  state: optional(nonEmptyString(100)),
  customerType: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (Object.values(CustomerType) as string[]).includes(v) ? v : 'INDIVIDUAL')
    .pipe(z.nativeEnum(CustomerType))
    .optional()
    .default('INDIVIDUAL'),
});

/** First non-empty value among candidate header names. */
function pick(record: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (v && v.trim() !== '') return v.trim();
  }
  return '';
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export async function importCustomers(
  user: AuthUser,
  records: Record<string, string>[],
): Promise<ImportReport> {
  const errors: ImportError[] = [];
  const valid: z.infer<typeof importRowSchema>[] = [];

  records.forEach((record, index) => {
    const mapped = {
      customerName: pick(record, 'customer name', 'customername', 'name'),
      phone: pick(record, 'phone', 'mobile', 'phone number'),
      companyName: pick(record, 'company', 'company name'),
      email: pick(record, 'email'),
      gstNumber: pick(record, 'gst', 'gst number', 'gstin'),
      panNumber: pick(record, 'pan'),
      city: pick(record, 'city'),
      state: pick(record, 'state'),
      customerType: pick(record, 'type', 'customer type'),
    };
    const parsed = importRowSchema.safeParse(mapped);
    if (parsed.success) valid.push(parsed.data);
    else {
      const first = parsed.error.issues[0];
      errors.push({ row: index + 2, message: `${first?.path.join('.')}: ${first?.message}` });
    }
  });

  // Pre-load existing identifiers for in-memory duplicate detection.
  const existing = await prisma.customer.findMany({
    where: { isDeleted: false },
    select: { phone: true, email: true, gstNumber: true },
  });
  const phones = new Set(existing.map((e) => e.phone));
  const emails = new Set(existing.map((e) => e.email).filter(Boolean));
  const gsts = new Set(existing.map((e) => e.gstNumber).filter(Boolean));

  const toInsert = valid.filter((row) => {
    const dup =
      phones.has(row.phone) ||
      (row.email && emails.has(row.email)) ||
      (row.gstNumber && gsts.has(row.gstNumber));
    if (dup) return false;
    // Also guard against duplicates *within* the file.
    phones.add(row.phone);
    if (row.email) emails.add(row.email);
    if (row.gstNumber) gsts.add(row.gstNumber);
    return true;
  });

  let imported = 0;
  if (toInsert.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of toInsert) {
        const code = await generateCode(tx, { key: 'customer', prefix: CODE_PREFIX.CUSTOMER });
        const addressData =
          row.city && row.state
            ? {
                addresses: {
                  create: [
                    {
                      addressType: 'BILLING' as const,
                      addressLine1: row.city,
                      city: row.city,
                      state: row.state,
                      postalCode: '000000',
                      country: 'India',
                      isDefault: true,
                      ...auditCreate(user.id),
                    },
                  ],
                },
              }
            : {};
        await tx.customer.create({
          data: {
            customerCode: code,
            customerType: row.customerType,
            customerName: row.customerName,
            companyName: row.companyName,
            phone: row.phone,
            email: row.email,
            gstNumber: row.gstNumber,
            panNumber: row.panNumber,
            ...auditCreate(user.id),
            ...addressData,
          },
        });
        imported++;
      }
    });
  }

  await logActivity({
    userId: user.id,
    activity: `Imported ${imported} customers`,
    module: 'customer',
  });

  return {
    total: records.length,
    imported,
    skipped: valid.length - toInsert.length,
    errors,
  };
}
