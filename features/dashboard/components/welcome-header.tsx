'use client';

/**
 * Dashboard welcome header (spec §78, §79): time-of-day greeting, live date &
 * time, role, and company name.
 */
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function WelcomeHeader({
  firstName,
  roleName,
  companyName,
}: {
  firstName: string;
  roleName: string;
  companyName: string;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        {now ? greeting(now) : 'Welcome'}, {firstName} <span aria-hidden>👋</span>
      </h1>
      <p className="text-sm text-muted-foreground">
        {roleName} · {companyName}
        {now && (
          <>
            {' · '}
            <span suppressHydrationWarning>{format(now, 'EEEE, dd MMM yyyy · hh:mm:ss a')}</span>
          </>
        )}
      </p>
    </div>
  );
}
