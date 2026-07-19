import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { logActivity } from '@/services/activity-log.service';
import { toCsv } from '@/utils/csv';
import { customerListQuerySchema } from '@/features/customer/customer.schema';
import {
  listCustomersForExport,
  outstandingByCustomer,
} from '@/features/customer/customer.repository';

export const dynamic = 'force-dynamic';

/** GET /api/customers/export — CSV of the current filtered set (spec §126). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('customer.export');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = customerListQuerySchema.parse(params);

  const customers = await listCustomersForExport(query);
  const outstanding = await outstandingByCustomer(customers.map((c) => c.id));

  const headers = [
    'Customer Code',
    'Name',
    'Company',
    'Type',
    'Phone',
    'Alternate Phone',
    'Email',
    'GST Number',
    'PAN',
    'City',
    'State',
    'Status',
    'Outstanding',
    'Created',
  ];
  const rows = customers.map((c) => [
    c.customerCode,
    c.customerName,
    c.companyName,
    c.customerType,
    c.phone,
    c.alternatePhone,
    c.email,
    c.gstNumber,
    c.panNumber,
    c.addresses[0]?.city ?? '',
    c.addresses[0]?.state ?? '',
    c.status,
    outstanding.get(c.id) ?? 0,
    c.createdAt.toISOString().slice(0, 10),
  ]);

  await logActivity({
    userId: user.id,
    activity: `Exported ${customers.length} customers`,
    module: 'customer',
  });

  const csv = toCsv(headers, rows);
  const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'x-request-id': requestId,
    },
  });
});
