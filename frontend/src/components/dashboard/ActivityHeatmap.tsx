import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityHeatmap as Heatmap } from '../../types/dashboard';
import { heatmapWeeks, monthLabels, parseDay, weekStartFor, type HeatLevel, type HeatmapCell } from '../../utils/activityHeatmap';
import { dateLocale } from '../../utils/locale';

/** One hue, light to dark; dark mode gets its own steps (brighter = more). */
const LEVEL_CLASSES: Record<HeatLevel, string> = {
  0: 'bg-gray-100 dark:bg-gray-800',
  1: 'bg-purple-200 dark:bg-purple-900',
  2: 'bg-purple-400 dark:bg-purple-700',
  3: 'bg-purple-600 dark:bg-purple-500',
  4: 'bg-purple-800 dark:bg-purple-300',
};
const CELL = 'w-3 h-3 sm:w-4 sm:h-4 xl:w-[18px] xl:h-[18px] rounded-[3px]';
const ROW = 'h-3 sm:h-4 xl:h-[18px] leading-3 sm:leading-4 xl:leading-[18px]';
const SWATCH = 'w-3 h-3 rounded-[3px]';

interface ActivityHeatmapProps {
  data: Heatmap | null;
  error?: boolean;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm lg:text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</dd>
    </div>
  );
}

/** Days of the last 12 weeks, shaded by how many diagrams were worked on. */
export function ActivityHeatmap({ data, error }: ActivityHeatmapProps) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [hovered, setHovered] = useState<HeatmapCell>(null);

  const weekStart = weekStartFor(i18n.language);
  const weeks = useMemo(() => heatmapWeeks(data?.days ?? [], weekStart), [data, weekStart]);
  const months = useMemo(() => monthLabels(weeks, locale), [weeks, locale]);
  // Row labels on Monday, Wednesday and Friday, whichever day the week starts on.
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, row) => {
        const weekday = (row + weekStart) % 7;
        if (![1, 3, 5].includes(weekday)) return '';
        const day = new Date(Date.UTC(2026, 0, 4 + weekday)); // Jan 4, 2026 is a Sunday
        return day.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
      }),
    [locale, weekStart],
  );

  const formatDay = (date: string) =>
    parseDay(date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const describe = (cell: NonNullable<HeatmapCell>) =>
    cell.count
      ? t('dashboard.activity.cell', { date: formatDay(cell.date), count: cell.count })
      : t('dashboard.activity.cellNone', { date: formatDay(cell.date) });

  const activeDays = (data?.days ?? []).filter((d) => d.count > 0);
  const worked = t('dashboard.activity.diagramsWorked', { count: data?.total ?? 0 });
  const active = t('dashboard.activity.activeDays', { count: data?.active_days ?? 0 });

  return (
    <section className="card p-5 sm:p-6 h-full" aria-labelledby="activity-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 mb-4">
        <div className="min-w-0">
          <h2 id="activity-title" className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t('dashboard.activity.title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.activity.subtitle')}</p>
        </div>
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('dashboard.activity.loadError')}</p>
      ) : !data ? (
        <div className="h-40 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden="true" />
      ) : (
        <>
          <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-5 lg:gap-8">
            <div className="min-w-0 flex-1">
              {/* The grid: one column per week, one row per weekday. */}
              <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <div
                  role="img"
                  aria-label={t('dashboard.activity.chartLabel', { worked, active })}
                  className="inline-flex gap-[3px]"
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex flex-col gap-[3px] pr-1.5 pt-5" aria-hidden="true">
                    {weekdayLabels.map((label, row) => (
                      <span key={row} className={`${ROW} text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap`}>
                        {label}
                      </span>
                    ))}
                  </div>
                  {weeks.map((week, col) => (
                    <div key={col} className="flex flex-col gap-[3px]">
                      <span className="h-4 mb-1 text-[10px] leading-4 text-gray-500 dark:text-gray-400 whitespace-nowrap" aria-hidden="true">
                        {months[col]}
                      </span>
                      {week.map((cell, row) =>
                        cell ? (
                          <span
                            key={row}
                            aria-hidden="true"
                            title={describe(cell)}
                            onMouseEnter={() => setHovered(cell)}
                            className={`${CELL} ${LEVEL_CLASSES[cell.level]} ${
                              hovered?.date === cell.date ? 'ring-2 ring-gray-900/60 dark:ring-white/70' : ''
                            }`}
                          />
                        ) : (
                          <span key={row} className={CELL} aria-hidden="true" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hover detail + legend */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-600 dark:text-gray-300 min-h-[1rem]" aria-hidden="true">
                  {hovered ? describe(hovered) : data.total === 0 ? t('dashboard.activity.empty') : t('dashboard.activity.hint')}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400" aria-hidden="true">
                  <span className="mr-1">{t('dashboard.activity.less')}</span>
                  {([0, 1, 2, 3, 4] as HeatLevel[]).map((level) => (
                    <span key={level} className={`${SWATCH} ${LEVEL_CLASSES[level]}`} />
                  ))}
                  <span className="ml-1">{t('dashboard.activity.more')}</span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-6 gap-y-4 lg:w-60 lg:flex-shrink-0 lg:pt-5">
              <Figure label={t('dashboard.activity.diagramsLabel')} value={String(data.total)} />
              <Figure label={t('dashboard.activity.activeDaysLabel')} value={String(data.active_days)} />
              <Figure label={t('dashboard.activity.currentStreak')} value={t('dashboard.activity.streakDays', { count: data.current_streak })} />
              <Figure label={t('dashboard.activity.longestStreak')} value={t('dashboard.activity.streakDays', { count: data.longest_streak })} />
            </dl>
          </div>

          {/* The same data as a table, for screen readers. */}
          {activeDays.length > 0 && (
            <table className="sr-only">
              <caption>{t('dashboard.activity.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.activity.tableDate')}</th>
                  <th scope="col">{t('dashboard.activity.tableCount')}</th>
                </tr>
              </thead>
              <tbody>
                {activeDays.map((day) => (
                  <tr key={day.date}>
                    <td>{formatDay(day.date)}</td>
                    <td>{day.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
