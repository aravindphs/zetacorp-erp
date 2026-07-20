'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { EmployeeDocumentType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { EmptyState } from '@/components/shared/page-states';
import { formatDateTime, formatFileSize } from '@/utils/format';
import {
  deleteEmployeeDocumentAction,
  getDocumentUrlAction,
  uploadEmployeeDocumentAction,
} from '@/features/workforce/document.actions';
import { DOCUMENT_TYPE_LABELS } from '@/features/workforce/employee.types';

export interface DocumentRow {
  id: string;
  documentType: EmployeeDocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  remarks: string | null;
  createdAt: string;
}

export function EmployeeDocuments({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: string;
  documents: DocumentRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<EmployeeDocumentType>('AADHAAR');
  const [remarks, setRemarks] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.set('employeeId', employeeId);
    formData.set('documentType', documentType);
    formData.set('remarks', remarks);
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadEmployeeDocumentAction(formData);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        setRemarks('');
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function download(documentId: string) {
    startTransition(async () => {
      const result = await getDocumentUrlAction(documentId);
      if (result.success) window.open(result.data.url, '_blank');
      else toast.error(result.message);
    });
  }

  function remove(documentId: string) {
    startTransition(async () => {
      const result = await deleteEmployeeDocumentAction(documentId, employeeId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Documents</h2>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload className="size-4" /> Upload
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents uploaded."
          description="Aadhaar, PAN, offer letters and certificates can be stored here."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Upload className="size-4" /> Upload document
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Uploaded</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.fileName}</p>
                        {d.remarks && (
                          <p className="truncate text-xs text-muted-foreground">{d.remarks}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{DOCUMENT_TYPE_LABELS[d.documentType]}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatFileSize(d.fileSize)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(d.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isPending}
                        onClick={() => download(d.id)}
                        title="Download"
                      >
                        <Download className="size-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          disabled={isPending}
                          onClick={() => remove(d.id)}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>PDF, PNG, JPG or JPEG — up to 10 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                items={DOCUMENT_TYPE_LABELS}
                value={documentType}
                onValueChange={(v) => setDocumentType((v as EmployeeDocumentType) ?? 'OTHER')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                ref={fileRef}
                accept="application/pdf,image/png,image/jpeg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-remarks">Remarks</Label>
              <Textarea
                id="doc-remarks"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
