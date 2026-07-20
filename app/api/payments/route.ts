import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { paymentListQuerySchema } from '@/features/payment/payment.schema';
import { getPaymentList } from '@/features/payment/payment.queries';
import { recordPaymentSchema } from '@/features/invoice/invoice.schema';
import { recordPayment } from '@/features/invoice/invoice.service';

export const dynamic = 'force-dynamic';

/** GET /api/payments — filtered, paginated payment list (spec §223, §236). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('payment.view');
  const query = paymentListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getPaymentList(query);
  return apiSuccess(rows, { message: 'Payments', meta, requestId });
});

const createPaymentSchema = recordPaymentSchema.extend({ invoiceId: uuidSchema });

/** POST /api/payments — record a payment against a posted invoice (spec §236). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('payment.create');
  const { invoiceId, ...data } = createPaymentSchema.parse(await request.json());
  const payment = await recordPayment(user, invoiceId, data);
  return apiSuccess(
    { id: payment.id, paymentNumber: payment.paymentNumber },
    { message: 'Payment recorded', status: HttpStatus.CREATED, requestId },
  );
});
