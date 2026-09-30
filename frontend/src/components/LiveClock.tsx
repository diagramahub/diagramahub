import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../utils/locale';

interface LiveClockProps {
  /** IANA timezone used to format the time (defaults to UTC). */
  timeZone?: string;
}

/**
 * Current time + date ticking every second.
 *
 * Kept in its own component so the per-second re-render stays local instead of
 * re-rendering the whole editor page.
 */
export function LiveClock({ timeZone = 'UTC' }: LiveClockProps) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const locale = dateLocale(i18n.language);

  return (
    <>
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone,
        })}
      </span>
      <span className="text-xs text-gray-400">•</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {now.toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone,
        })}
      </span>
    </>
  );
}
