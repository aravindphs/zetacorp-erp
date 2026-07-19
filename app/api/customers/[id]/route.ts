import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema, deleteReasonSchema } from '@/schemas/common';
import { updateCustomerSchema } from '@/features/customer/customer.schema';
import {
  deleteCustomer,
  getCustomerProfileOrThrow,
  updateCustomer,
} from '@/features/customer/customer.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/customers/{id} — customer profile (spec §127). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('customer.view');
  const { id } = await ctx.params;
  const customer = await getCustomerProfileOrThrow(uuidSchema.parse(id));
  return apiSuccess(customer, { message: 'Customer', requestId });
});

/** PUT /api/customers/{id} — update (spec §127). */
export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('customer.update');
  const { id } = await ctx.params;
  const data = updateCustomerSchema.parse(await request.json());
  const customer = await updateCustomer(user, uuidSchema.parse(id), data);
  return apiSuccess({ id: customer.id }, { message: 'Customer updated', requestId });
});

/** DELETE /api/customers/{id} — soft delete (spec §127, §16). */
export const DELETE = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('customer.delete');
  const { id } = await ctx.params;
  const { reason } = deleteReasonSchema.parse(await request.json().catch(() => ({})));
  await deleteCustomer(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Customer deleted', requestId });
});
