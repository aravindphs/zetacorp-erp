import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { customerListQuerySchema } from '@/features/customer/customer.schema';
import { getCustomerList } from '@/features/customer/customer.service';

export const dynamic = 'force-dynamic';

/** GET /api/customers/search?q= — quick customer lookup (spec §123, §127). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('customer.view');
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const query = customerListQuerySchema.parse({ search: q, pageSize: 10, page: 1 });
  const { rows } = await getCustomerList(query);
  return apiSuccess(rows, { message: 'Search results', requestId });
});
