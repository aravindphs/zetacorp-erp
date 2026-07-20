import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { deleteReasonSchema, uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { updateEmployeeSchema } from '@/features/workforce/employee.schema';
import { getEmployeeDetail } from '@/features/workforce/employee.queries';
import { deleteEmployee, updateEmployee } from '@/features/workforce/employee.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/employees/{id} — full profile (§261). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('employee.view');
  const { id } = await ctx.params;
  const employee = await getEmployeeDetail(uuidSchema.parse(id));
  if (!employee) throw new NotFoundError('Employee not found.');

  return apiSuccess(
    {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
      joiningDate: employee.joiningDate?.toISOString() ?? null,
      lastLoginAt: employee.lastLoginAt?.toISOString() ?? null,
      role: employee.role,
      department: employee.department,
      designation: employee.designation,
      reportingManager: employee.reportingManager,
      documentCount: employee.documents.length,
    },
    { message: 'Employee', requestId },
  );
});

/** PUT /api/employees/{id} — update profile & account (§261). */
export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('employee.update');
  const { id } = await ctx.params;
  const data = updateEmployeeSchema.parse(await request.json());
  const employee = await updateEmployee(user, uuidSchema.parse(id), data);
  return apiSuccess({ id: employee.id }, { message: 'Employee updated', requestId });
});

/** DELETE /api/employees/{id} — soft delete; never a hard delete (§264). */
export const DELETE = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('employee.delete');
  const { id } = await ctx.params;
  const { reason } = deleteReasonSchema.parse(await request.json());
  await deleteEmployee(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Employee removed', requestId });
});
