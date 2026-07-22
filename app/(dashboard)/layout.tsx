/**
 * Protected application shell (spec §77, §78). Enforces authentication
 * server-side (spec §15, §55) — the middleware redirects anonymous users and
 * this is the authoritative backstop — then renders the permission-aware
 * sidebar + header around the page.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { AnnouncementGate } from '@/features/announcement/components/announcement-gate';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <SidebarProvider>
      <AppSidebar
        permissions={[...user.permissions]}
        user={{
          fullName: user.fullName,
          email: user.email,
          roleName: user.roleName,
          profilePhoto: user.profilePhoto,
        }}
      />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
      {/*
        Blocks the whole shell until required announcements are acknowledged.
        Mounted here (not per page) so it survives client-side navigation and
        checks once per page load rather than on every route change.
      */}
      <AnnouncementGate />
    </SidebarProvider>
  );
}
