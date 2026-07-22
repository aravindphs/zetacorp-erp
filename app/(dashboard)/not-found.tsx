import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/shared/button-link';
import { EmptyState } from '@/components/shared/page-states';

/** Shown for any unknown route inside the app shell (spec §342). */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="This page doesn't exist, or the record was removed. Check the link, or head back to your dashboard."
        action={<ButtonLink href="/dashboard">Back to dashboard</ButtonLink>}
      />
    </div>
  );
}
