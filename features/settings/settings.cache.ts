import 'server-only';

/**
 * Request-cached access to system settings (spec §41, §95 — "cache static
 * settings"). Loads all settings once per request via React `cache`, so many
 * callers share a single query.
 */
import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export const getSettingsMap = cache(async (): Promise<Map<string, unknown>> => {
  const rows = await prisma.systemSetting.findMany({
    select: { settingKey: true, settingValue: true },
  });
  return new Map(rows.map((r) => [r.settingKey, r.settingValue as unknown]));
});

/** Read a single setting value with a typed fallback. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const map = await getSettingsMap();
  const value = map.get(key);
  return value === undefined || value === null ? fallback : (value as T);
}
