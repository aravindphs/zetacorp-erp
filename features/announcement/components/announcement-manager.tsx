'use client';

/**
 * Announcements board (spec §37). Authors draft and publish; visibility is
 * targeted by role, with an empty selection meaning everyone.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnnouncementPriority } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/page-states';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatDate, formatDateTime } from '@/utils/format';
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  setAnnouncementPublishedAction,
  updateAnnouncementAction,
} from '@/features/announcement/announcement.actions';
import type { AnnouncementRow } from '@/features/announcement/announcement.queries';

const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

const PRIORITY_CLASSES: Record<AnnouncementPriority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-blue-500/10 text-blue-600',
  HIGH: 'bg-destructive/10 text-destructive',
};

export function AnnouncementManager({
  announcements,
  roles,
  perms,
}: {
  announcements: AnnouncementRow[];
  roles: string[];
  perms: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canPublish: boolean;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AnnouncementRow | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('MEDIUM');
  const [publishDate, setPublishDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [visibleRoles, setVisibleRoles] = useState<string[]>([]);

  function openForm(row: AnnouncementRow | 'new') {
    setEditing(row);
    if (row === 'new') {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setPublishDate('');
      setExpiryDate('');
      setIsPublished(false);
      setVisibleRoles([]);
    } else {
      setTitle(row.title);
      setDescription(row.description);
      setPriority(row.priority);
      setPublishDate(row.publishDate?.slice(0, 10) ?? '');
      setExpiryDate(row.expiryDate?.slice(0, 10) ?? '');
      setIsPublished(row.isPublished);
      setVisibleRoles(row.visibleRoles);
    }
  }

  function toggleRole(role: string) {
    setVisibleRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function run(fn: () => Promise<{ success: boolean; message: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(result.message);
        onOk?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {perms.canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm('new')}>
            <Plus className="size-4" /> New announcement
          </Button>
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Post an update for your team."
          action={
            perms.canCreate ? (
              <Button size="sm" onClick={() => openForm('new')}>
                <Plus className="size-4" /> New announcement
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{a.title}</h3>
                      <Badge variant="secondary" className={PRIORITY_CLASSES[a.priority]}>
                        {PRIORITY_LABELS[a.priority]}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          a.isPublished
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {a.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.authorName} · {formatDateTime(a.createdAt)}
                      {a.expiryDate ? ` · expires ${formatDate(a.expiryDate)}` : ''}
                      {a.visibleRoles.length > 0
                        ? ` · visible to ${a.visibleRoles.join(', ')}`
                        : ' · visible to everyone'}
                      {a.isPublished
                        ? ` · acknowledged by ${a.acknowledgedCount}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    {perms.canPublish && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isPending}
                        title={a.isPublished ? 'Unpublish' : 'Publish'}
                        onClick={() =>
                          run(() => setAnnouncementPublishedAction(a.id, !a.isPublished))
                        }
                      >
                        {a.isPublished ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    )}
                    {perms.canUpdate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Edit"
                        onClick={() => openForm(a)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {perms.canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        disabled={isPending}
                        title="Delete"
                        onClick={() => setConfirmDelete(a)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.title ?? ''}"?`}
        description="This removes the announcement for everyone. This cannot be undone."
        confirmLabel="Delete announcement"
        isPending={isPending}
        onConfirm={() =>
          confirmDelete &&
          run(() => deleteAnnouncementAction(confirmDelete.id), () => setConfirmDelete(null))
        }
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'New announcement' : 'Edit announcement'}
            </DialogTitle>
            <DialogDescription>
              Leave roles unselected to show this to everyone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-desc">Message</Label>
              <Textarea
                id="ann-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  items={PRIORITY_LABELS}
                  value={priority}
                  onValueChange={(v) => setPriority((v as AnnouncementPriority) ?? 'MEDIUM')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-publish">Publish date</Label>
                <Input
                  id="ann-publish"
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-expiry">Expiry date</Label>
                <Input
                  id="ann-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visible to</Label>
              <div className="flex flex-wrap gap-3">
                {roles.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visibleRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
              {visibleRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">Currently visible to everyone.</p>
              )}
            </div>

            {perms.canPublish && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                Published
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !title.trim() || !description.trim()}
              onClick={() => {
                const payload = {
                  title,
                  description,
                  priority,
                  publishDate: publishDate || undefined,
                  expiryDate: expiryDate || undefined,
                  isPublished,
                  visibleRoles,
                };
                run(
                  () =>
                    editing === 'new'
                      ? createAnnouncementAction(payload)
                      : updateAnnouncementAction((editing as AnnouncementRow).id, payload),
                  () => setEditing(null),
                );
              }}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
