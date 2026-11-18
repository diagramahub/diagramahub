import type { ActivityDay } from '../types/dashboard';

/** One square of the heatmap; null pads the first and last weeks. */
export type HeatmapCell = (ActivityDay & { level: HeatLevel; weekday: number }) | null;
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Weeks start on Sunday in English and on Monday in Spanish. */
export function weekStartFor(language: string): 0 | 1 {
  return language.startsWith('en') ? 0 : 1;
}

/** The user's IANA time zone, so days end at their midnight (undefined if unknown). */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** A YYYY-MM-DD date as a UTC Date (no shift by the browser's zone). */
export function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 0 = no activity; 1-4 split the busiest day's count in quarters. */
export function heatLevel(count: number, max: number): HeatLevel {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as HeatLevel;
}

/**
 * Columns of 7 days (one per week), oldest first, the way the heatmap draws them.
 * The days must be consecutive; the first and last weeks are padded with null.
 */
export function heatmapWeeks(days: ActivityDay[], weekStartsOn: 0 | 1): HeatmapCell[][] {
  if (!days.length) return [];
  const max = Math.max(...days.map((d) => d.count));
  const row = (date: string) => (parseDay(date).getUTCDay() - weekStartsOn + 7) % 7;
  const cells: HeatmapCell[] = Array.from({ length: row(days[0].date) }, () => null);
  for (const day of days) {
    cells.push({ ...day, level: heatLevel(day.count, max), weekday: parseDay(day.date).getUTCDay() });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A month name over the first week where that month starts ('' elsewhere). */
export function monthLabels(weeks: HeatmapCell[][], locale: string): string[] {
  let previous = -1;
  return weeks.map((week) => {
    const first = week.find((cell) => cell !== null);
    if (!first) return '';
    const month = parseDay(first.date).getUTCMonth();
    if (month === previous) return '';
    previous = month;
    return parseDay(first.date).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
  });
}
