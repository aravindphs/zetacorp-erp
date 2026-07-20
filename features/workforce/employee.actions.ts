'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { deleteReasonSchema } from '@/schemas/common';
import {
  changeRoleSchema,
  changeStatusSchema,
  createEmployeeSchema,
  resetPasswordSchema,
  updateEmployeeSchema,
} from '@/features/workforce/employee.schema';
import {
  changeEmployeeRole,
  changeEmployeeStatus,
  createEmployee,
  deleteEmployee,
  resetEmployeePassword,
  updateEmployee,
} from '@/features/workforce/employee.service';

const LIST_PATH = '/workforce/employees';

export async function createEmployeeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.create');
    const data = createEmployeeSchema.parse(input);
    const employee = await createEmployee(user, data);
    revalidatePath(LIST_PATH);
    return actionOk({ id: employee.id }, `Employee ${employee.employeeCode} created.`);
  });
}

export async function updateEmployeeAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.update');
    const data = updateEmployeeSchema.parse(input);
    const employee = await updateEmployee(user, id, data);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk({ id: employee.id }, 'Employee updated.');
  });
}

export async function resetEmployeePasswordAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.reset_password');
    const { password } = resetPasswordSchema.parse(input);
    await resetEmployeePassword(user, id, password);
    return actionOk(null, 'Password reset.');
  });
}

export async function changeEmployeeRoleAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.change_role');
    const { roleId } = changeRoleSchema.parse(input);
    await changeEmployeeRole(user, id, roleId);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Role updated. Permissions refresh immediately.');
  });
}

export async function changeEmployeeStatusAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.update');
    const data = changeStatusSchema.parse(input);
    await changeEmployeeStatus(user, id, data);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, `Status set to ${data.status}.`);
  });
}

export async function deleteEmployeeAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('employee.delete');
    const { reason } = deleteReasonSchema.parse(input);
    await deleteEmployee(user, id, reason);
    revalidatePath(LIST_PATH);
    return actionOk(null, 'Employee removed.');
  });
}
