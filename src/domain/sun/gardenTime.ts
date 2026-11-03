import tzlookup from '@photostructure/tz-lookup';

/**
 * Garden-local time handling.
 *
 * The garden's clock is defined by the IANA zone at the garden's location,
 * never by the phone's zone. All conversions go through Intl with an explicit
 * `timeZone`, which handles DST transitions from the bundled ICU data.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
  offsetMinutes: number;
}

let intlSupport: boolean | null = null;

/** True if the JS engine can convert between arbitrary IANA time zones. */
export function supportsIntlTimeZones(): boolean {
  if (intlSupport !== null) return intlSupport;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    // 00:00 UTC is 05:45 in Kathmandu (UTC+5:45, no DST) — a distinctive check.
    const s = f.format(new Date(Date.UTC(2026, 0, 1, 0, 0)));
    intlSupport = /5:45/.test(s);
  } catch {
    intlSupport = false;
  }
  return intlSupport;
}

export function timezoneForLocation(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** Offset of `tz` from UTC at the instant `utcMs`, in minutes (east positive). */
export function offsetMinutesAt(tz: string, utcMs: number): number {
  if (tz === 'UTC' || !supportsIntlTimeZones()) return 0;
  const parts = partsFormatter(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  const wholeSecondUtc = Math.floor(utcMs / 1000) * 1000;
  return Math.round((asUtc - wholeSecondUtc) / 60000);
}

export function utcToZoned(tz: string, utcMs: number): ZonedParts {
  const off = offsetMinutesAt(tz, utcMs);
  const d = new Date(utcMs + off * 60000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    offsetMinutes: off,
  };
}

export interface ZonedToUtcResult {
  utcMs: number;
  offsetMinutes: number;
  /** Wall time does not exist (spring-forward gap); result was shifted forward. */
  nonexistent: boolean;
  /** Wall time occurs twice (fall-back overlap); the earlier instant was chosen. */
  ambiguous: boolean;
}

/** Parses YYYY-MM-DD. */
export function parseDate(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Converts a garden wall-clock time to a UTC instant. */
export function zonedToUtc(tz: string, date: string, minutes: number): ZonedToUtcResult {
  const { year, month, day } = parseDate(date);
  const localMs = Date.UTC(year, month - 1, day, 0, 0) + minutes * 60000;
  const before = offsetMinutesAt(tz, localMs - 36 * 3600000);
  const after = offsetMinutesAt(tz, localMs + 36 * 3600000);
  const candidates = Array.from(new Set([before, after, offsetMinutesAt(tz, localMs)]));
  const valid = candidates
    .map((o) => localMs - o * 60000)
    .filter((t) => offsetMinutesAt(tz, t) * 60000 === localMs - t)
    .sort((a, b) => a - b);
  if (valid.length > 0) {
    const utcMs = valid[0];
    return {
      utcMs,
      offsetMinutes: offsetMinutesAt(tz, utcMs),
      nonexistent: false,
      ambiguous: valid.length > 1,
    };
  }
  // Gap: interpret with the pre-transition offset, which lands after the gap.
  const utcMs = localMs - before * 60000;
  return { utcMs, offsetMinutes: offsetMinutesAt(tz, utcMs), nonexistent: true, ambiguous: false };
}

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '−';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Phone (device) zone, for showing a secondary clock when it differs. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Today's date in the garden's zone. */
export function todayInZone(tz: string, nowMs = Date.now()): { date: string; minutes: number } {
  const p = utcToZoned(tz, nowMs);
  return { date: formatDate(p.year, p.month, p.day), minutes: p.hour * 60 + p.minute };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyDate(date: string): string {
  const { year, month, day } = parseDate(date);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
