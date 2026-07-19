import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { parseCsv } from '@/utils/csv';
import { importCustomers } from '@/features/customer/customer.import';

export const dynamic = 'force-dynamic';

/** POST /api/customers/import — CSV body (text/csv) (spec §125, §127). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('customer.import');
  const csv = await request.text();
  const records = parseCsv(csv);
  const report = await importCustomers(user, records);
  return apiSuccess(report, { message: 'Import complete', requestId });
});
