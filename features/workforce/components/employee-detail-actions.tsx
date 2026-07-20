'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Pencil, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import type { UserStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/shared/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  changeEmployeeRoleAction,
  changeEmployeeStatusAction,
  resetEmployeePasswordAction,
} from '@/features/workforce/employee.actions';
import { EMPLOYEE_STATUS_LABELS } from '@/features/workforce/employee.types';

export function EmployeeDetailActions({
  employeeId,
  currentRoleId,
  currentStatus,
  roles,
  canUpdate,
  canResetPassword,
  canChangeRole,
  isSelf,
}: {
  employeeId: string;
  currentRoleId: string;
  currentStatus: UserStatus;
  roles: { id: string; name: string }[];
  canUpdate: boolean;
  canResetPassword: boolean;
  canChangeRole: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pwOpen, setPwOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(currentRoleId);
  const [status, setStatus] = useState<UserStatus>(currentStatus);
  const [reason, setReason] = useState('');

  function run(fn: () => Promise<{ success: boolean; message: string }>, onOk: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(result.message);
        onOk();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate && (
        <ButtonLink href={`/workforce/employees/${employeeId}/edit`} size="sm" variant="outline">
          <Pencil className="size-4" /> Edit
        </ButtonLink>
      )}
      {canResetPassword && (
        <Button size="sm" variant="outline" onClick={() => setPwOpen(true)}>
          <KeyRound className="size-4" /> Reset password
        </Button>
      )}
      {canChangeRole && (
        <Button size="sm" variant="outline" onClick={() => setRoleOpen(true)}>
          <ShieldCheck className="size-4" /> Change role
        </Button>
      )}
      {canUpdate && !isSelf && (
        <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
          <UserCog className="size-4" /> Change status
        </Button>
      )}

      {/* Reset password (§258, §259) */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Sets a new login password immediately. At least 12 characters with upper, lower,
              number and symbol.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || password.length < 12}
              onClick={() =>
                run(
                  () => resetEmployeePasswordAction(employeeId, { password }),
                  () => {
                    setPwOpen(false);
                    setPassword('');
                  },
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role (§258, §264) */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Permissions refresh immediately on the employee&apos;s next request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
              value={roleId}
              onValueChange={(v) => setRoleId((v as string) ?? currentRoleId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || roleId === currentRoleId}
              onClick={() =>
                run(
                  () => changeEmployeeRoleAction(employeeId, { roleId }),
                  () => setRoleOpen(false),
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Change role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change status (§247, §258 — only ACTIVE users can sign in) */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Only active employees can sign in. Terminated employees keep their records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                items={EMPLOYEE_STATUS_LABELS}
                value={status}
                onValueChange={(v) => setStatus((v as UserStatus) ?? currentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-reason">Reason</Label>
              <Textarea
                id="status-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || status === currentStatus}
              onClick={() =>
                run(
                  () => changeEmployeeStatusAction(employeeId, { status, reason: reason || undefined }),
                  () => setStatusOpen(false),
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
