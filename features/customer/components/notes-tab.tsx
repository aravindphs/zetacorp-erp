'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/page-states';
import { formatDateTime } from '@/utils/format';
import {
  addCustomerNoteAction,
  deleteCustomerNoteAction,
} from '@/features/customer/customer.actions';

interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  edited: boolean;
}

export function NotesTab({
  customerId,
  notes,
  currentUserName,
  canManage,
}: {
  customerId: string;
  notes: Note[];
  currentUserName: string;
  canManage: boolean;
}) {
  const [items, setItems] = useState<Note[]>(notes);
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  // Keep local state in sync when the server sends fresh notes (e.g. reload).
  useEffect(() => setItems(notes), [notes]);

  function add() {
    startTransition(async () => {
      const result = await addCustomerNoteAction(customerId, { content });
      if (result.success) {
        toast.success(result.message);
        setItems((prev) => [
          {
            id: result.data.id,
            content,
            author: currentUserName,
            createdAt: new Date().toISOString(),
            edited: false,
          },
          ...prev,
        ]);
        setContent('');
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCustomerNoteAction(id, customerId);
      if (result.success) {
        toast.success(result.message);
        setItems((prev) => prev.filter((n) => n.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add an internal note (not printed on documents)…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={isPending || content.trim().length === 0}>
              {isPending && <Loader2 className="size-4 animate-spin" />} Add note
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No notes yet" description="Internal notes about this customer appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((note) => (
            <li key={note.id} className="rounded-lg border p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.content}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {note.author} · {formatDateTime(note.createdAt)}
                  {note.edited && ' · edited'}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(note.id)}
                    disabled={isPending}
                    className="text-destructive hover:underline"
                  >
                    <Trash2 className="inline size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
