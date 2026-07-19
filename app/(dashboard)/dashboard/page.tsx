import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requirePermission } from '@/lib/auth/guards';
import { getSetting } from '@/features/settings/settings.cache';
import { SectionErrorBoundary } from '@/components/shared/error-boundary';
import { WelcomeHeader } from '@/features/dashboard/components/welcome-header';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import {
  AlertsSection,
  ChartsSection,
  ChartsSkeleton,
  ListsSkeleton,
  RecentSection,
  StatsSection,
  StatsSkeleton,
} from '@/features/dashboard/components/sections';

export const metadata: Metadata = { title: 'Dashboard' };

/** A dashboard section: isolated error handling + streamed via Suspense. */
function Section({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return (
    <SectionErrorBoundary>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SectionErrorBoundary>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission('dashboard.view');
  const companyName = await getSetting('company.name', 'NSquare Energies');

  return (
    <div className="space-y-6">
      <WelcomeHeader
        firstName={user.fullName.split(' ')[0] ?? user.fullName}
        roleName={user.roleName}
        companyName={companyName}
      />

      <Section fallback={<StatsSkeleton />}>
        <StatsSection user={user} />
      </Section>

      <QuickActions user={user} />

      <Section fallback={<ChartsSkeleton />}>
        <ChartsSection user={user} />
      </Section>

      <Section fallback={<ListsSkeleton />}>
        <RecentSection user={user} />
      </Section>

      <Section fallback={<ListsSkeleton />}>
        <AlertsSection user={user} />
      </Section>
    </div>
  );
}
