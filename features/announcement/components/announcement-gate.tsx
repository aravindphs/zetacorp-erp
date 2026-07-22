'use client';

/**
 * Blocking acknowledgement prompt.
 *
 * When a published announcement targets the signed-in user's role, they cannot
 * use the app until they type the confirmation word. Pending announcements are
 * shown one at a time, highest priority first.
 *
 * Performance: this lives in the dashboard layout, which persists across
 * client-side navigation, so it fetches ONCE per full page load rather than on
 * every route change — no query is added to the per-request server path.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { acknowledgeAnnouncementAction } from '@/features/announcement/announcement.actions';
import type { ApiResponse } from '@/types/api';

interface PendingAnnouncement {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  publishDate: string | null;
}

const CONFIRM_WORD = 'acknowledge';

const PRIORITY_CLASSES: Record<PendingAnnouncement['priority'], string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-blue-500/10 text-blue-600',
  HIGH: 'bg-destructive/10 text-destructive',
};

export function AnnouncementGate() {
  const [pending, setPending] = useState<PendingAnnouncement[]>([]);
  const [typed, setTyped] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/announcements/pending')
      .then((r) => r.json() as Promise<ApiResponse<PendingAnnouncement[]>>)
      .then((json) => {
        if (!cancelled && json.success) setPending(json.data);
      })
      .catch(() => {
        // A failed check must never lock the user out of the app.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = pending[0] ?? null;

  // While blocked, suppress background scrolling so only the prompt is usable.
  useEffect(() => {
    if (!current) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [current]);

  // Swallow keys that would let the user tab or escape into the page behind.
  useEffect(() => {
    if (!current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [current]);

  const confirm = useCallback(() => {
    if (!current || typed.trim().toLowerCase() !== CONFIRM_WORD) {
      setError(`Type "${CONFIRM_WORD}" exactly to continue.`);
      return;
    }
    setIsSaving(true);
    setError(null);
    void acknowledgeAnnouncementAction(current.id)
      .then((result) => {
        if (result.success) {
          setPending((prev) => prev.slice(1));
          setTyped('');
        } else {
          setError(result.message);
        }
      })
      .finally(() => setIsSaving(false));
  }, [current, typed]);

  if (!current) return null;

  const remaining = pending.length - 1;

  return (
    // Rendered outside the Dialog primitive on purpose: this must not be
    // dismissible by escape, overlay click, or a close button.
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ann-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
        <div className="mb-3 flex items-start gap-3">
          <span className="rounded-md bg-muted p-2">
            <AlertTriangle className="size-5 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="ann-gate-title" className="text-lg font-semibold">
                {current.title}
              </h2>
              <Badge variant="secondary" className={PRIORITY_CLASSES[current.priority]}>
                {current.priority}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              This announcement requires your acknowledgement.
              {remaining > 0 && ` ${remaining} more after this.`}
            </p>
          </div>
        </div>

        <div className="mb-4 max-h-[40vh] overflow-y-auto rounded-md bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-sm">{current.description}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-gate-input">
            Type <span className="font-semibold">Acknowledge</span> to continue
          </Label>
          <Input
            id="ann-gate-input"
            autoFocus
            autoComplete="off"
            value={typed}
            placeholder="Acknowledge"
            disabled={isSaving}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={confirm}
            disabled={isSaving || typed.trim().toLowerCase() !== CONFIRM_WORD}
          >
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Acknowledge
          </Button>
        </div>
      </div>
    </div>
  );
}
