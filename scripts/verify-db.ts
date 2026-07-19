/**
 * Quick connectivity + RLS sanity check. Run with: pnpm tsx scripts/verify-db.ts
 * Confirms Prisma can read/write with RLS (and FORCE RLS) enabled.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [permissions, roles, users, settings, leaveTypes, expenseCategories] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.user.count(),
    prisma.systemSetting.count(),
    prisma.leaveType.count(),
    prisma.expenseCategory.count(),
  ]);

  // Prove a write works under RLS too, then clean it up.
  const probe = await prisma.systemHealthLog.create({ data: { databaseStatus: 'probe' } });
  await prisma.systemHealthLog.delete({ where: { id: probe.id } });

  console.log(
    JSON.stringify(
      { permissions, roles, users, settings, leaveTypes, expenseCategories, writeOk: true },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error('VERIFY FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
