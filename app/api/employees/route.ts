import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import {
  createEmployeeSchema,
  employeeListQuerySchema,
} from '@/features/workforce/employee.schema';
import { getEmployeeList } from '@/features/workforce/employee.queries';
import { createEmployee } from '@/features/workforce/employee.service';

export const dynamic = 'force-dynamic';

/** GET /api/employees — filtered, paginated employee list (§248, §261). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('employee.view');
  const query = employeeListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getEmployeeList(query);
  return apiSuccess(rows, { message: 'Employees', meta, requestId });
});

/** POST /api/employees — create an employee and their login account (§261). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('employee.create');
  const data = createEmployeeSchema.parse(await request.json());
  const employee = await createEmployee(user, data);
  return apiSuccess(
    { id: employee.id, employeeCode: employee.employeeCode },
    { message: 'Employee created', status: HttpStatus.CREATED, requestId },
  );
});
