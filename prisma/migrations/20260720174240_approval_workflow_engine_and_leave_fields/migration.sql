-- CreateEnum
CREATE TYPE "ApprovalApproverRule" AS ENUM ('ANY_HIGHER_ROLE', 'SPECIFIC_ROLE', 'REPORTING_MANAGER', 'SPECIFIC_USER');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "approval_request_id" UUID,
ADD COLUMN     "delegate_employee_id" UUID,
ADD COLUMN     "emergency_contact" TEXT,
ADD COLUMN     "is_half_day" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_rule" "ApprovalApproverRule" NOT NULL,
    "role_id" UUID,
    "user_id" UUID,
    "skip_if_unresolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "current_step" INTEGER,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "approval_request_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_workflows_module_is_active_idx" ON "approval_workflows"("module", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_module_name_key" ON "approval_workflows"("module", "name");

-- CreateIndex
CREATE INDEX "approval_workflow_steps_workflow_id_idx" ON "approval_workflow_steps"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_steps_workflow_id_step_order_key" ON "approval_workflow_steps"("workflow_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_requests_module_reference_id_idx" ON "approval_requests"("module", "reference_id");

-- CreateIndex
CREATE INDEX "approval_requests_requester_id_idx" ON "approval_requests"("requester_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_actions_approval_request_id_idx" ON "approval_actions"("approval_request_id");

-- CreateIndex
CREATE INDEX "approval_actions_actor_id_idx" ON "approval_actions"("actor_id");

-- CreateIndex
CREATE INDEX "leave_requests_approval_request_id_idx" ON "leave_requests"("approval_request_id");

-- AddForeignKey
ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "approval_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_delegate_employee_id_fkey" FOREIGN KEY ("delegate_employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
