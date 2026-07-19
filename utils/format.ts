/**
 * Shared display formatters. Values from Prisma `Decimal` columns arrive as
 * strings, so money/number helpers accept `number | string`.
 */
import { format } from 'date-fns';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: number | string | null | undefined): string {
  return inrFormatter.format(toNumber(value));
}

export function formatNumber(value: number | string | null | undefined): string {
  return numberFormatter.format(toNumber(value));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy');
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy, hh:mm a');
}

/** Human-readable file size (for backups/uploads). */
export function formatFileSize(bytes: number | bigint | null | undefined): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : (bytes ?? 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
