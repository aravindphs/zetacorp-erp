'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { departmentSchema, designationSchema } from '@/features/workforce/catalogue.schema';
import {
  createDepartment,
  createDesignation,
  deleteDepartment,
  deleteDesignation,
  updateDepartment,
  updateDesignation,
} from '@/features/workforce/catalogue.service';

const DEPARTMENTS_PATH = '/workforce/departments';
const DESIGNATIONS_PATH = '/workforce/designations';

// --- Departments (§252) ---------------------------------------------------

export async function createDepartmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('department.manage');
    const data = departmentSchema.parse(input);
    const department = await createDepartment(user, data);
    revalidatePath(DEPARTMENTS_PATH);
    return actionOk({ id: department.id }, 'Department created.');
  });
}

export async function updateDepartmentAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('department.manage');
    const data = departmentSchema.parse(input);
    const department = await updateDepartment(user, id, data);
    revalidatePath(DEPARTMENTS_PATH);
    return actionOk({ id: department.id }, 'Department updated.');
  });
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('department.manage');
    await deleteDepartment(user, id);
    revalidatePath(DEPARTMENTS_PATH);
    return actionOk(null, 'Department deleted.');
  });
}

// --- Designations (§253) --------------------------------------------------

export async function createDesignationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('designation.manage');
    const data = designationSchema.parse(input);
    const designation = await createDesignation(user, data);
    revalidatePath(DESIGNATIONS_PATH);
    return actionOk({ id: designation.id }, 'Designation created.');
  });
}

export async function updateDesignationAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('designation.manage');
    const data = designationSchema.parse(input);
    const designation = await updateDesignation(user, id, data);
    revalidatePath(DESIGNATIONS_PATH);
    return actionOk({ id: designation.id }, 'Designation updated.');
  });
}

export async function deleteDesignationAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('designation.manage');
    await deleteDesignation(user, id);
    revalidatePath(DESIGNATIONS_PATH);
    return actionOk(null, 'Designation deleted.');
  });
}
