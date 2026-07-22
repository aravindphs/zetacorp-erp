/**
 * Point the stored company settings at the current legal entity.
 *
 * `pnpm db:seed` deliberately never overwrites an admin-edited setting value,
 * so changing COMPANY_NAME in code does not update an existing row — this does.
 *
 * Run with: pnpm tsx scripts/set-company-name.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { COMPANY_NAME } from '../constants/app';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const key of ['company.name', 'company.legal_name']) {
    await prisma.systemSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: COMPANY_NAME },
      create: {
        settingKey: key,
        settingValue: COMPANY_NAME,
        category: 'company',
        description: 'Company name printed on documents.',
        isPublic: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`${key} -> ${COMPANY_NAME}`);
  }
}

main()
  .catch((error) => {
    console.error('Failed to update company name:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
