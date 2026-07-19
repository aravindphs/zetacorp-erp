import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { cancelInvoiceSchema } from '@/features/invoice/invoice.schema';
import { cancelInvoice } from '@/features/invoice/invoice.service';

export const dynamic = 'force-dynamic';

/** POST /api/invoices/{id}/cancel — restore stock and mark CANCELLED (§209, §211). */
export const POST = withApiHandler(async (request, requestId, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission('invoice.cancel');
  const { id } = await ctx.params;
  const { reason } = cancelInvoiceSchema.parse(await request.json());
  await cancelInvoice(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Invoice cancelled', requestId });
});
