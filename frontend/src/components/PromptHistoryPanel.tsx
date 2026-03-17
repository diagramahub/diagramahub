import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import ConfirmModal from './ConfirmModal';
import { PromptHistoryEntry, PaginatedPromptHistory } from '../types/promptHistory';

interface PromptHistoryPanelProps {
  onSelectPrompt: (text: string) => void;
  operationType?: 'creation' | 'improvement';
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  // Ensure UTC parsing: append Z if no timezone indicator present
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') && dateStr.match(/[+-]\d{2}:\d{2}$/)
    ? dateStr
    : dateStr + 'Z';
  const date = new Date(normalized);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 30) return `hace ${diffDays}d`;
  return date.toLocaleDateString();
}

export default function PromptHistoryPanel({ onSelectPrompt, operationType }: PromptHistoryPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedPromptHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<PromptHistoryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromptHistoryEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiService.getPromptHistory({
        page,
        page_size: 20,
        search: debouncedSearch || undefined,
      });
      setData(result);
    } catch {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiService.deletePromptHistory(deleteTarget.id);
      if (selectedEntry?.id === deleteTarget.id) {
        setSelectedEntry(null);
      }
      setDeleteTarget(null);
      fetchHistory();
    } catch {
      setError(t('errors.networkError'));
      setDeleteTarget(null);
    }
  };

  const handleCopy = async (text: string, entryId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entryId || '_detail');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError(t('errors.genericError'));
    }
  };

  const handleLoad = (text: string) => {
    onSelectPrompt(text);
    setSelectedEntry(null);
  };

  const filteredByType = data?.items?.filter(
    (entry) => !operationType || entry.operation_type === operationType
  ) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('ai.promptHistory.title')}
        </h3>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-3">
        {/* Error */}
        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Detail view */}
        {selectedEntry ? (
          <div className="flex flex-col flex-1 space-y-2 overflow-hidden">
            {/* Top bar: Back + Copy/Delete icons */}
            <div className="flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('common.back')}
              </button>
              <div className="flex items-center gap-1">
                {/* Copy icon */}
                <button
                  type="button"
                  onClick={() => handleCopy(selectedEntry.prompt_text, selectedEntry.id)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 transition-colors"
                  title={t('ai.promptHistory.copy')}
                >
                  {copiedId === selectedEntry.id ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                {/* Delete icon */}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedEntry)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                  title={t('ai.promptHistory.delete')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Prompt text */}
            <div className="bg-white rounded-lg p-3 border border-gray-200 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  selectedEntry.operation_type === 'creation'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedEntry.operation_type === 'creation'
                    ? t('ai.promptHistory.creation')
                    : t('ai.promptHistory.improvement')}
                </span>
                <span className="text-xs text-gray-400">
                  {formatRelativeDate(selectedEntry.used_at)}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {selectedEntry.prompt_text}
              </p>
            </div>

            {/* Use prompt button - full width */}
            <button
              type="button"
              onClick={() => handleLoad(selectedEntry.prompt_text)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex-shrink-0"
            >
              {t('ai.promptHistory.load')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-2 flex-shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('ai.promptHistory.searchPlaceholder')}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-6 flex-1">
                <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {/* Entry list */}
            {!loading && filteredByType.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {filteredByType.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
                  >
                    {/* Clickable text area */}
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm text-gray-700 truncate">
                        {entry.prompt_text.length > 60
                          ? entry.prompt_text.substring(0, 60) + '...'
                          : entry.prompt_text}
                      </p>
                      <span className="text-xs text-gray-400">
                        {formatRelativeDate(entry.used_at)}
                      </span>
                    </button>

                    {/* Copy icon */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopy(entry.prompt_text, entry.id); }}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                      title={t('ai.promptHistory.copy')}
                    >
                      {copiedId === entry.id ? (
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>

                    {/* Delete icon */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry); }}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title={t('ai.promptHistory.delete')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && data && data.items.length === 0 && !debouncedSearch && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center">
                  {t('ai.promptHistory.emptyMessage')}
                </p>
              </div>
            )}

            {/* No results */}
            {!loading && data && data.items.length === 0 && debouncedSearch && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center">
                  {t('ai.promptHistory.noResults')}
                </p>
              </div>
            )}

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                <span className="text-xs text-gray-500">
                  {page} / {data.total_pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('ai.promptHistory.delete')}
        message={t('ai.promptHistory.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous
      />
    </div>
  );
}