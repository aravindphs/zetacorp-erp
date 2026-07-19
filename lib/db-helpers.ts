/**
 * Small helpers that encode the cross-cutting database rules (spec §16, §19,
 * §45) so repositories don't duplicate them:
 *   - exclude soft-deleted rows from normal reads
 *   - stamp created_by / updated_by / deleted_by consistently
 *
 * Business logic stays in services; these are pure field builders.
 */

/** Spread into a `where` clause to hide soft-deleted rows (spec §16). */
export const notDeleted = { isDeleted: false } as const;

/** Audit fields for a create (spec §19). */
export function auditCreate(userId: string | null) {
  return { createdBy: userId, updatedBy: userId };
}

/** Audit field for an update (spec §19, §45 — every update touches updated_by). */
export function auditUpdate(userId: string | null) {
  return { updatedBy: userId };
}

/** Fields for a soft delete (spec §16 — deleted_at / deleted_by retained). */
export function softDelete(userId: string | null) {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId,
  };
}
