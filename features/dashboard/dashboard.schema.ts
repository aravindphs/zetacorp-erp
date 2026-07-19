import { z } from 'zod';

/** Chart date-range filter (spec §81, §92). */
export const chartRangeSchema = z
  .enum(['today', 'week', 'month', 'quarter', 'year'])
  .default('month');

export type ChartRangeInput = z.infer<typeof chartRangeSchema>;
