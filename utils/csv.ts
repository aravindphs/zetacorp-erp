/**
 * Minimal, correct CSV generation (RFC 4180 quoting). Reused by export
 * endpoints across modules.
 */
export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  // Prepend a UTF-8 BOM so Excel opens non-ASCII (₹, names) correctly.
  return `﻿${lines.join('\r\n')}`;
}

/**
 * Parse CSV text (RFC 4180: quoted fields, escaped quotes, CRLF/LF) into an
 * array of records keyed by the header row. Header keys are lower-cased and
 * trimmed for tolerant column matching.
 */
export function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^﻿/, ''); // strip BOM
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return [];

  const headers = (nonEmpty[0] ?? []).map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? '').trim();
    });
    return record;
  });
}
