/**
 * Auth route-group layout — a centered, minimal shell for unauthenticated
 * pages (spec §11 UI standards). Already-authenticated users are bounced to the
 * dashboard by the middleware.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
