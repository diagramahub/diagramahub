import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import type { PromptHistoryEntry } from '../types/promptHistory';
import { dateLocale } from '../utils/locale';

interface PromptHistoryMenuProps {
  /** Called with the chosen prompt so the chat input can be filled with it. */
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Chat footer button that lists the user's earlier prompts (the ones that
 * produced a diagram) so they can be reused. Opens upwards, like the model menu.
 */
export function PromptHistoryMenu({ onSelect, disabled = false }: PromptHistoryMenuProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PromptHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(false);
    try {
      const page = await apiService.getPromptHistory({
        page: 1,
        page_size: PAGE_SIZE,
        search: query.trim() || undefined,
      });
      setItems(page.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when opened and, debounced, while typing a search.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => load(search), search ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [open, search, load]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (entry: PromptHistoryEntry) => {
    onSelect(entry.prompt_text);
    setOpen(false);
  };

  const handleDelete = async (entry: PromptHistoryEntry) => {
    const previous = items;
    setItems(items.filter((i) => i.id !== entry.id));
    try {
      await apiService.deletePromptHistory(entry.id);
    } catch {
      setItems(previous);
      setError(true);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale(i18n.language), {
      day: 'numeric',
      month: 'short',
    });

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">{t('promptHistory.button')}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('promptHistory.title')}
          className="absolute bottom-full left-0 mb-1 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-30"
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('promptHistory.searchPlaceholder')}
              aria-label={t('promptHistory.searchPlaceholder')}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {loading && items.length === 0 && (
              <p className="px-3 py-4 text-xs text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            )}
            {error && (
              <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{t('promptHistory.error')}</p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="px-3 py-4 text-xs text-center text-gray-500 dark:text-gray-400">
                {search ? t('promptHistory.noResults') : t('promptHistory.empty')}
              </p>
            )}
            {items.map((entry) => (
              <div key={entry.id} className="group flex items-start gap-1 px-1">
                <button
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className="flex-1 min-w-0 text-left px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <span className="block text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{entry.prompt_text}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-semibold ${
                        entry.operation_type === 'creation'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}
                    >
                      {t(`promptHistory.operation.${entry.operation_type}`)}
                    </span>
                    {formatDate(entry.used_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  aria-label={t('promptHistory.delete')}
                  className="mt-1.5 p-1 rounded text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
