import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import type { DiagramSearchResult } from '../types/project';
import { highlightParts } from '../utils/highlight';

interface ContentSearchResultsProps {
  projectId: string;
  /** Search text (trimmed); nothing is fetched below 2 characters. */
  query: string;
  /** Only diagrams of this type, or all when null. */
  diagramType: string | null;
  /** Diagrams already listed because their title matched (not repeated here). */
  excludeIds: Set<string>;
  onOpen: (diagramId: string) => void;
  badgeFor: (diagramType: string) => { label: string; className: string };
}

const DEBOUNCE_MS = 300;

/**
 * Explorer section with diagrams whose description or code contains the search
 * text (the tree itself only matches titles and folder names).
 */
export function ContentSearchResults({
  projectId,
  query,
  diagramType,
  excludeIds,
  onOpen,
  badgeFor,
}: ContentSearchResultsProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<DiagramSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = query.length >= 2 && !!projectId;

  useEffect(() => {
    if (!active) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      apiService
        .searchDiagrams({ q: query, project_id: projectId, type: diagramType ?? undefined })
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, query, projectId, diagramType]);

  if (!active) return null;
  const inContent = results.filter((r) => r.matched_in !== 'title' && !excludeIds.has(r.id));
  if (!loading && !failed && inContent.length === 0) return null;

  return (
    <section aria-label={t('fileBrowser.inContent')} className="mt-2 pt-2 mx-1 border-t border-gray-100 dark:border-gray-800">
      <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {t('fileBrowser.inContent')}
        {inContent.length > 0 && ` (${inContent.length})`}
      </h3>
      {loading && inContent.length === 0 && (
        <p className="px-2 py-1 text-[11px] text-gray-400 dark:text-gray-500">{t('fileBrowser.searchingContent')}</p>
      )}
      {failed && <p className="px-2 py-1 text-[11px] text-red-600 dark:text-red-400">{t('fileBrowser.contentSearchError')}</p>}
      {inContent.map((r) => {
        const badge = badgeFor(r.diagram_type);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r.id)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <span className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold px-1 rounded ${badge.className}`}>{badge.label}</span>
              <span className="truncate text-gray-700 dark:text-gray-300">{r.title}</span>
            </span>
            {r.snippet && (
              <span className="block mt-0.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2 break-all">
                {highlightParts(r.snippet, query).map((part, i) =>
                  part.match ? (
                    <mark key={i} className="bg-yellow-200 text-gray-900 dark:bg-yellow-600/60 dark:text-gray-100 rounded-sm">
                      {part.text}
                    </mark>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
