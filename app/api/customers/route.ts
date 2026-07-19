import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { customerListQuerySchema, createCustomerSchema } from '@/features/customer/customer.schema';
import { createCustomer, getCustomerList } from '@/features/customer/customer.service';

export const dynamic = 'force-dynamic';

/** GET /api/customers — paginated, filtered list (spec §127). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('customer.view');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = customerListQuerySchema.parse(params);
  const { rows, meta } = await getCustomerList(query);
  return apiSuccess(rows, { message: 'Customers', meta, requestId });
});

/** POST /api/customers — create a customer (spec §127). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('customer.create');
  const body = await request.json();
  const data = createCustomerSchema.parse(body);
  const customer = await createCustomer(user, data);
  return apiSuccess(
    { id: customer.id, customerCode: customer.customerCode },
    { message: 'Customer created', status: HttpStatus.CREATED, requestId },
  );
});
