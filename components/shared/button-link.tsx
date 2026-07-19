import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A button-styled navigation link. base-nova's Button renders a native
 * `<button>` by default; when it should be an anchor we must set
 * `nativeButton={false}` (Base UI) to keep correct semantics. This wrapper
 * encapsulates that so pages don't repeat it.
 */
export function ButtonLink({
  href,
  children,
  ...props
}: ComponentProps<typeof Button> & { href: string }) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} {...props}>
      {children}
    </Button>
  );
}
