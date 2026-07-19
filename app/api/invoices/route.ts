import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { createInvoiceSchema, invoiceListQuerySchema } from '@/features/invoice/invoice.schema';
import { getInvoiceList } from '@/features/invoice/invoice.queries';
import { createInvoice } from '@/features/invoice/invoice.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('invoice.view');
  const query = invoiceListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getInvoiceList(query);
  return apiSuccess(rows, { message: 'Invoices', meta, requestId });
});

export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('invoice.create');
  const data = createInvoiceSchema.parse(await request.json());
  const invoice = await createInvoice(user, data);
  return apiSuccess(
    { id: invoice.id, invoiceNumber: invoice.invoiceNumber },
    { message: 'Invoice created', status: HttpStatus.CREATED, requestId },
  );
});
