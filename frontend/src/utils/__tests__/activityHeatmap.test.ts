import { describe, expect, it } from 'vitest';
import { heatLevel, heatmapWeeks, monthLabels, weekStartFor } from '../activityHeatmap';

/** Consecutive days from `start` (YYYY-MM-DD), with these counts. */
function days(start: string, counts: number[]) {
  const first = new Date(`${start}T00:00:00Z`).getTime();
  return counts.map((count, i) => ({
    date: new Date(first + i * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

describe('activity heatmap', () => {
  it('splits the busiest day in quarters', () => {
    expect([0, 1, 2, 3, 4, 8].map((n) => heatLevel(n, 8))).toEqual([0, 1, 1, 2, 2, 4]);
    expect(heatLevel(1, 1)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });

  it('lays the days out in weeks, padding the edges', () => {
    // 2026-11-18 is a Wednesday.
    const range = days('2026-11-18', [1, 0, 2, 0, 0, 0, 0, 3]);

    const mondayFirst = heatmapWeeks(range, 1);
    const sundayFirst = heatmapWeeks(range, 0);

    expect(mondayFirst).toHaveLength(2);
    expect(mondayFirst[0].slice(0, 2)).toEqual([null, null]);
    expect(mondayFirst[0][2]?.date).toBe('2026-11-18');
    expect(mondayFirst[1][2]?.date).toBe('2026-11-25');
    expect(mondayFirst[1].slice(3)).toEqual([null, null, null, null]);
    expect(sundayFirst[0][3]?.date).toBe('2026-11-18');
    expect(mondayFirst.flat().filter(Boolean)).toHaveLength(8);
    expect(mondayFirst[1][2]?.level).toBe(4);
  });

  it('names each month once, over the week it starts', () => {
    const weeks = heatmapWeeks(days('2026-10-20', Array(28).fill(0)), 1);
    expect(monthLabels(weeks, 'en-US')).toEqual(['Oct', '', 'Nov', '', '']);
  });

  it('starts weeks on Sunday in English and Monday in Spanish', () => {
    expect(weekStartFor('en')).toBe(0);
    expect(weekStartFor('es')).toBe(1);
  });
});
