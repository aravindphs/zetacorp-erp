import 'server-only';

/**
 * Concurrency-safe human-readable code generation (spec §107 — codes are never
 * reused; gaps are acceptable). Must run inside the same transaction as the
 * record being numbered so the number and the row commit atomically.
 *
 * The sequence row is created on first use, then incremented with a locking
 * `UPDATE ... RETURNING`, which serialises concurrent callers on the row lock
 * and hands each a distinct value.
 */
import type { Prisma } from '@prisma/client';

export interface CodeSpec {
  /** Unique sequence key, e.g. `customer` or `invoice:2026`. */
  key: string;
  /** Printed prefix, e.g. `CUS` or `INV-2026`. */
  prefix: string;
  /** Zero-pad width. */
  padding?: number;
}

export async function generateCode(
  tx: Prisma.TransactionClient,
  spec: CodeSpec,
): Promise<string> {
  const padding = spec.padding ?? 6;

  await tx.$executeRaw`
    INSERT INTO number_sequences (key, prefix, padding, next_value)
    VALUES (${spec.key}, ${spec.prefix}, ${padding}, 1)
    ON CONFLICT (key) DO NOTHING`;

  const rows = await tx.$queryRaw<{ value: number; prefix: string; padding: number }[]>`
    UPDATE number_sequences
    SET next_value = next_value + 1
    WHERE key = ${spec.key}
    RETURNING (next_value - 1) AS value, prefix, padding`;

  const row = rows[0];
  if (!row) throw new Error(`Failed to generate code for sequence "${spec.key}".`);
  return `${row.prefix}-${String(row.value).padStart(row.padding, '0')}`;
}
