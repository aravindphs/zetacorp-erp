import { redirect } from 'next/navigation';

/**
 * Root entry — the middleware already routes based on auth state; this is a
 * server-side backstop so a direct hit never renders a blank page.
 */
export default function RootPage() {
  redirect('/dashboard');
}
