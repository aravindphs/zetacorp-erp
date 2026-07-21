import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { inventoryReportSchema } from '@/features/reports/report.schema';
import { getInventoryReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/inventory — stock aggregates (§325, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.inventory');
  const query = inventoryReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getInventoryReport(query);
  return apiSuccess(data, { message: 'Inventory report', requestId });
});
