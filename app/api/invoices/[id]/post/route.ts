import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { postInvoice } from '@/features/invoice/invoice.service';

export const dynamic = 'force-dynamic';

/** POST /api/invoices/{id}/post — deduct stock and mark POSTED (§203, §211). */
export const POST = withApiHandler(async (_request, requestId, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission('invoice.post');
  const { id } = await ctx.params;
  await postInvoice(user, uuidSchema.parse(id));
  return apiSuccess(null, { message: 'Invoice posted', requestId });
});
