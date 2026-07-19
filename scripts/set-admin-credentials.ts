/**
 * Update the default Admin account's email + password to the values in
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Idempotent and safe to re-run.
 *
 * Updates both Supabase Auth (the credential store) and the `users` row (the
 * application profile) so they stay in sync.
 *
 * Run with: pnpm tsx scripts/set-admin-credentials.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { ROLE_NAMES } from '@/constants/roles';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
  if (!url || !serviceKey) throw new Error('Supabase URL and service role key are required.');

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the Admin account (there is exactly one system admin after seeding).
  const admin = await prisma.user.findFirst({
    where: { role: { name: ROLE_NAMES.ADMIN }, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error('No Admin user found — run the seed first.');

  const { error: authError } = await supabase.auth.admin.updateUserById(admin.id, {
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });
  if (authError) throw authError;

  await prisma.user.update({
    where: { id: admin.id },
    data: { email: email.toLowerCase() },
  });

  // eslint-disable-next-line no-console
  console.log(`Admin credentials updated: ${admin.email} -> ${email.toLowerCase()}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to update admin credentials:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
