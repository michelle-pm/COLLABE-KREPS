export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  // Excel serial starts from 1899-12-30
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseAnyDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  
  if (typeof value === "number") {
    return excelSerialToDate(value);
  }

  const raw = String(value).trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "null") return null;

  // Try ISO or standard Date string
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  // Try DD.MM.YYYY
  const dmY = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    const year = parseInt(dmY[3], 10);
    const d2 = new Date(year, month, day);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }

  // Try YYYY-MM-DD
  const Ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (Ymd) {
    const year = parseInt(Ymd[1], 10);
    const month = parseInt(Ymd[2], 10) - 1;
    const day = parseInt(Ymd[3], 10);
    const d3 = new Date(year, month, day);
    return Number.isNaN(d3.getTime()) ? null : d3;
  }

  return null;
}

export function toIsoOrNull(value: unknown): string | null {
  const d = parseAnyDate(value);
  return d ? d.toISOString() : null;
}

export function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 7); // YYYY-MM
}

export interface DateParseResult {
  raw: any;
  iso: string | null;
  monthKey: string | null;
  error: boolean;
}

export function processDate(value: unknown): DateParseResult {
  const iso = toIsoOrNull(value);
  const error = (value != null && value !== "" && value !== "-") && !iso;
  return {
    raw: value ?? null,
    iso,
    monthKey: monthKey(iso),
    error
  };
}
