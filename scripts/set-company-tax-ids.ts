/**
 * Set the company GSTIN and CIN printed on invoices and quotations.
 *
 * `pnpm db:seed` never overwrites an admin-edited setting value, so these must
 * be written directly. Run with: pnpm tsx scripts/set-company-tax-ids.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALUES: Record<string, string> = {
  'company.gst_number': '33AACCZ7281P1ZM',
  'company.cin': 'U73100TZ2025PTC035852',
};

async function main(): Promise<void> {
  for (const [settingKey, settingValue] of Object.entries(VALUES)) {
    await prisma.systemSetting.upsert({
      where: { settingKey },
      update: { settingValue },
      create: {
        settingKey,
        settingValue,
        category: 'company',
        description: 'Company tax identifier printed on documents.',
        isPublic: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`${settingKey} -> ${settingValue}`);
  }
}

main()
  .catch((error) => {
    console.error('Failed to set company tax ids:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
