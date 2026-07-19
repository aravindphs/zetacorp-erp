'use client';

/**
 * Global client providers: theme (dark mode, spec §12) and toast notifications.
 * Mounted once in the root layout.
 */
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
