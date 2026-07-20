import 'server-only';

/**
 * Approval Workflow Engine (spec §284, §307).
 *
 * Feature modules (leave, expenses) submit a record here and ask the engine who
 * may act on it. They never encode approver rules themselves — a workflow is an
 * ordered list of steps stored as data, so approval behaviour is reconfigurable
 * without code changes.
 *
 * The seeded default is a single `ANY_HIGHER_ROLE` step, which yields the
 * intended hierarchy: Manager and Admin can approve Staff requests, while a
 * Manager's own request can only be approved by an Admin.
 */
import { Prisma, type ApprovalApproverRule } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface ApprovalOutcome {
  approvalRequestId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  currentStep: number | null;
}

interface WorkflowStep {
  stepOrder: number;
  name: string;
  approverRule: ApprovalApproverRule;
  roleId: string | null;
  userId: string | null;
  skipIfUnresolved: boolean;
}

interface CachedWorkflow {
  id: string;
  steps: WorkflowStep[];
}

/**
 * Workflow definitions change rarely but are read on every submit/approve, so
 * they are cached per module. Editing a workflow must call
 * `invalidateApprovalWorkflow`.
 */
const WORKFLOW_TTL_MS = 60_000;
const workflowCache = new Map<string, { workflow: CachedWorkflow; expiresAt: number }>();

export function invalidateApprovalWorkflow(module?: string): void {
  if (module) workflowCache.delete(module);
  else workflowCache.clear();
}

/**
 * `db` must be the caller's transaction client when this runs inside a
 * transaction. Using the global client there would check out a second
 * connection while the first is held — a deadlock wherever the pool is small
 * (Vercel runs `connection_limit=1`).
 */
async function getWorkflow(
  module: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CachedWorkflow> {
  const cached = workflowCache.get(module);
  if (cached && cached.expiresAt > Date.now()) return cached.workflow;

  const record = await db.approvalWorkflow.findFirst({
    where: { module, isActive: true, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      steps: {
        orderBy: { stepOrder: 'asc' },
        select: {
          stepOrder: true,
          name: true,
          approverRule: true,
          roleId: true,
          userId: true,
          skipIfUnresolved: true,
        },
      },
    },
  });

  // §292: a missing workflow is a configuration error, not a user error.
  if (!record || record.steps.length === 0) {
    throw new BusinessRuleError(
      `No approval workflow is configured for "${module}". Ask an administrator to set one up.`,
    );
  }

  const workflow: CachedWorkflow = { id: record.id, steps: record.steps };
  workflowCache.set(module, { workflow, expiresAt: Date.now() + WORKFLOW_TTL_MS });
  return workflow;
}

/** Open a workflow instance for a freshly submitted record. */
export async function startApproval(
  tx: Prisma.TransactionClient,
  input: { module: string; referenceId: string; requesterId: string },
): Promise<ApprovalOutcome> {
  const workflow = await getWorkflow(input.module, tx);
  const firstStep = workflow.steps[0]!;

  const request = await tx.approvalRequest.create({
    data: {
      workflowId: workflow.id,
      module: input.module,
      referenceId: input.referenceId,
      requesterId: input.requesterId,
      currentStep: firstStep.stepOrder,
      status: 'PENDING',
    },
    select: { id: true, currentStep: true },
  });

  return { approvalRequestId: request.id, status: 'PENDING', currentStep: request.currentStep };
}

/** Does `actor` satisfy this step's approver rule for this requester? */
async function actorSatisfiesStep(
  step: WorkflowStep,
  actor: AuthUser,
  requesterId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  // Nobody approves their own request, whatever the rule says.
  if (actor.id === requesterId) return false;

  switch (step.approverRule) {
    case 'ANY_HIGHER_ROLE': {
      const requester = await db.user.findFirst({
        where: { id: requesterId },
        select: { role: { select: { level: true } } },
      });
      if (!requester) return false;
      return actor.roleLevel > requester.role.level;
    }
    case 'SPECIFIC_ROLE':
      return Boolean(step.roleId) && actor.roleId === step.roleId;
    case 'SPECIFIC_USER':
      return Boolean(step.userId) && actor.id === step.userId;
    case 'REPORTING_MANAGER': {
      const requester = await db.user.findFirst({
        where: { id: requesterId },
        select: { reportingManagerId: true },
      });
      return Boolean(requester?.reportingManagerId) && requester!.reportingManagerId === actor.id;
    }
    default:
      return false;
  }
}

/** Can this user act on the pending step of this approval request? */
export async function canActOnApproval(
  approvalRequestId: string,
  actor: AuthUser,
): Promise<boolean> {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: approvalRequestId },
    select: { module: true, requesterId: true, currentStep: true, status: true },
  });
  if (!request || request.status !== 'PENDING' || request.currentStep === null) return false;

  const workflow = await getWorkflow(request.module);
  const step = workflow.steps.find((s) => s.stepOrder === request.currentStep);
  if (!step) return false;

  return actorSatisfiesStep(step, actor, request.requesterId);
}

/**
 * Record a decision on the current step and advance the workflow.
 *
 * APPROVED moves to the next step, or completes the request when none remain.
 * REJECTED terminates immediately (§287 — a rejected record is not resubmitted;
 * a new one is raised instead).
 */
export async function recordApprovalDecision(
  tx: Prisma.TransactionClient,
  actor: AuthUser,
  approvalRequestId: string,
  decision: ApprovalDecision,
  remarks?: string,
): Promise<ApprovalOutcome> {
  const request = await tx.approvalRequest.findFirst({
    where: { id: approvalRequestId },
    select: { id: true, module: true, requesterId: true, currentStep: true, status: true },
  });
  if (!request) throw new NotFoundError('Approval request not found.');
  if (request.status !== 'PENDING' || request.currentStep === null) {
    throw new BusinessRuleError('This request has already been decided.');
  }

  const workflow = await getWorkflow(request.module, tx);
  const step = workflow.steps.find((s) => s.stepOrder === request.currentStep);
  if (!step) throw new BusinessRuleError('The configured approval step no longer exists.');

  const allowed = await actorSatisfiesStep(step, actor, request.requesterId, tx);
  if (!allowed) {
    throw new ForbiddenError('You are not an approver for this request at its current step.');
  }

  await tx.approvalAction.create({
    data: {
      approvalRequestId,
      stepOrder: step.stepOrder,
      stepName: step.name,
      actorId: actor.id,
      action: decision,
      remarks,
    },
  });

  if (decision === 'REJECTED') {
    await tx.approvalRequest.update({
      where: { id: approvalRequestId },
      data: { status: 'REJECTED', currentStep: null, completedAt: new Date() },
    });
    return { approvalRequestId, status: 'REJECTED', currentStep: null };
  }

  const nextStep = workflow.steps.find((s) => s.stepOrder > step.stepOrder);
  if (!nextStep) {
    await tx.approvalRequest.update({
      where: { id: approvalRequestId },
      data: { status: 'APPROVED', currentStep: null, completedAt: new Date() },
    });
    return { approvalRequestId, status: 'APPROVED', currentStep: null };
  }

  await tx.approvalRequest.update({
    where: { id: approvalRequestId },
    data: { currentStep: nextStep.stepOrder },
  });
  return { approvalRequestId, status: 'PENDING', currentStep: nextStep.stepOrder };
}

/** Close an open workflow because the underlying record was withdrawn. */
export async function cancelApproval(
  tx: Prisma.TransactionClient,
  approvalRequestId: string,
  actorId: string,
  remarks?: string,
): Promise<void> {
  const request = await tx.approvalRequest.findFirst({
    where: { id: approvalRequestId },
    select: { status: true, currentStep: true },
  });
  if (!request || request.status !== 'PENDING') return;

  await tx.approvalAction.create({
    data: {
      approvalRequestId,
      stepOrder: request.currentStep ?? 0,
      stepName: 'Cancelled',
      actorId,
      action: 'CANCELLED',
      remarks,
    },
  });
  await tx.approvalRequest.update({
    where: { id: approvalRequestId },
    data: { status: 'CANCELLED', currentStep: null, completedAt: new Date() },
  });
}

export interface ApprovalTimelineEntry {
  id: string;
  stepOrder: number;
  stepName: string;
  action: string;
  remarks: string | null;
  actorName: string;
  createdAt: string;
}

/** Decision history for the Approval Timeline tab (§281). */
export async function getApprovalTimeline(
  approvalRequestId: string,
): Promise<ApprovalTimelineEntry[]> {
  const actions = await prisma.approvalAction.findMany({
    where: { approvalRequestId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      stepOrder: true,
      stepName: true,
      action: true,
      remarks: true,
      actorId: true,
      createdAt: true,
    },
  });
  if (actions.length === 0) return [];

  // Actor ids are scalar audit columns (no FK relation), so names resolve here.
  const actorIds = [...new Set(actions.map((a) => a.actorId))];
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  return actions.map((a) => ({
    id: a.id,
    stepOrder: a.stepOrder,
    stepName: a.stepName,
    action: a.action,
    remarks: a.remarks,
    actorName: nameById.get(a.actorId) ?? 'Unknown',
    createdAt: a.createdAt.toISOString(),
  }));
}

/**
 * Approval requests awaiting *this* user, for "pending my approval" views.
 * Filters in SQL where possible, then applies the per-step rule.
 */
export async function listPendingForApprover(
  module: string,
  actor: AuthUser,
): Promise<string[]> {
  const pending = await prisma.approvalRequest.findMany({
    where: { module, status: 'PENDING', requesterId: { not: actor.id } },
    select: { id: true, referenceId: true, requesterId: true, currentStep: true },
  });
  if (pending.length === 0) return [];

  const workflow = await getWorkflow(module);
  const results: string[] = [];
  for (const request of pending) {
    const step = workflow.steps.find((s) => s.stepOrder === request.currentStep);
    if (!step) continue;
    if (await actorSatisfiesStep(step, actor, request.requesterId)) {
      results.push(request.referenceId);
    }
  }
  return results;
}
