/**
 * Leave duration calculation (spec §279). Pure and server-authoritative.
 *
 * Company holidays are a future extension (§279); weekend exclusion is
 * configurable via the `leave.exclude_weekends` setting.
 */

/** Inclusive day count between two dates, optionally skipping Sat/Sun. */
export function calculateLeaveDays(
  fromDate: Date,
  toDate: Date,
  options: { excludeWeekends: boolean; isHalfDay: boolean },
): number {
  if (options.isHalfDay) return 0.5;

  // Normalise to UTC midnight so DST never shifts the count.
  const start = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  if (end < start) return 0;

  const MS_PER_DAY = 86_400_000;
  let days = 0;

  for (let ts = start; ts <= end; ts += MS_PER_DAY) {
    if (options.excludeWeekends) {
      const day = new Date(ts).getUTCDay();
      if (day === 0 || day === 6) continue;
    }
    days += 1;
  }
  return days;
}

/** Do two inclusive date ranges share any day? */
export function rangesOverlap(
  aFrom: Date,
  aTo: Date,
  bFrom: Date,
  bTo: Date,
): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}
