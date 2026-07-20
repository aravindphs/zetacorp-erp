'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import {
  applyLeaveSchema,
  cancelLeaveSchema,
  leaveDecisionSchema,
  updateLeaveSchema,
} from '@/features/leave/leave.schema';
import {
  applyForLeave,
  cancelLeave,
  decideLeave,
  updateLeave,
} from '@/features/leave/leave.service';

const LIST_PATH = '/workforce/leave';

export async function applyForLeaveAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('leave.create');
    const data = applyLeaveSchema.parse(input);
    const leave = await applyForLeave(user, data);
    revalidatePath(LIST_PATH);
    return actionOk(
      { id: leave.id },
      data.submit ? `Leave ${leave.leaveNumber} submitted for approval.` : 'Draft saved.',
    );
  });
}

export async function updateLeaveAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('leave.update');
    const data = updateLeaveSchema.parse(input);
    const leave = await updateLeave(user, id, data);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk({ id: leave.id }, data.submit ? 'Leave submitted.' : 'Draft updated.');
  });
}

export async function approveLeaveAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('leave.approve');
    const { remarks } = leaveDecisionSchema.parse(input);
    await decideLeave(user, id, 'APPROVED', remarks);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Leave approved.');
  });
}

export async function rejectLeaveAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('leave.reject');
    const { remarks } = leaveDecisionSchema.parse(input);
    await decideLeave(user, id, 'REJECTED', remarks);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Leave rejected.');
  });
}

export async function cancelLeaveAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    // Employees may withdraw their own request; the service enforces ownership
    // for anyone without leave.cancel.
    const user = await requirePermission('leave.view');
    const { reason } = cancelLeaveSchema.parse(input);
    await cancelLeave(user, id, reason);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Leave cancelled.');
  });
}
