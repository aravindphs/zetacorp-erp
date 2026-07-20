import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { createQuotationSchema, quotationListQuerySchema } from '@/features/quotation/quotation.schema';
import { getQuotationList } from '@/features/quotation/quotation.queries';
import { createQuotation } from '@/features/quotation/quotation.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('quotation.view');
  const query = quotationListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getQuotationList(query);
  return apiSuccess(rows, { message: 'Quotations', meta, requestId });
});

export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('quotation.create');
  const data = createQuotationSchema.parse(await request.json());
  const q = await createQuotation(user, data);
  return apiSuccess(
    { id: q.id, quotationNumber: q.quotationNumber },
    { message: 'Quotation created', status: HttpStatus.CREATED, requestId },
  );
});
