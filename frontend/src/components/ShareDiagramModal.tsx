import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { SharedLink, CreateSharedLinkRequest } from '../types/sharing';

interface ShareDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
  diagramTitle: string;
}

type ExpirationOption = 5 | 10 | 30 | null;

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const ShareDiagramModal: React.FC<ShareDiagramModalProps> = ({
  isOpen,
  onClose,
  diagramId,
  diagramTitle,
}) => {
  const { t, i18n } = useTranslation();

  const expirationOptions: { value: ExpirationOption; label: string }[] = [
    { value: 5, label: t('sharing.days', { count: 5 }) },
    { value: 10, label: t('sharing.days', { count: 10 }) },
    { value: 30, label: t('sharing.days', { count: 30 }) },
    { value: null, label: t('sharing.unlimited') },
  ];

  function formatDate(dateStr: string): string {
    const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';
    return new Date(dateStr).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Form state
  const [expiration, setExpiration] = useState<ExpirationOption>(30);
  const [accessType, setAccessType] = useState<'public' | 'protected'>('public');
  const [accessCode, setAccessCode] = useState('');
  const [allowCopyCode, setAllowCopyCode] = useState(false);

  // Existing link state
  const [existingLink, setExistingLink] = useState<SharedLink | null>(null);
  const [plainAccessCode, setPlainAccessCode] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const fetchExistingLink = useCallback(async () => {
    if (!diagramId) return;
    setLoadingLink(true);
    setError(null);
    try {
      const link = await api.getSharedLinkByDiagram(diagramId);
      if (link) {
        setExistingLink(link);
        setAccessType(link.access_type);
        setAllowCopyCode(link.allow_copy_code);
        if (link.access_code) {
          setPlainAccessCode(link.access_code);
        }
      } else {
        setExistingLink(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setExistingLink(null);
      } else {
        setError(t('sharing.loadError'));
      }
    } finally {
      setLoadingLink(false);
    }
  }, [diagramId, t]);

  useEffect(() => {
    if (isOpen && diagramId) {
      fetchExistingLink();
    }
    if (!isOpen) {
      setExistingLink(null);
      setPlainAccessCode(null);
      setExpiration(30);
      setAccessType('public');
      setAccessCode('');
      setAllowCopyCode(false);
      setError(null);
      setLinkCopied(false);
      setCodeCopied(false);
    }
  }, [isOpen, diagramId, fetchExistingLink]);

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: CreateSharedLinkRequest = {
        diagram_id: diagramId,
        expiration_days: expiration,
        access_type: accessType,
        allow_copy_code: allowCopyCode,
      };
      if (accessType === 'protected') {
        data.access_code = accessCode || undefined;
      }
      const link = await api.createSharedLink(data);
      setExistingLink(link);
      if (link.access_code) {
        setPlainAccessCode(link.access_code);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('sharing.generateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!existingLink) return;
    setRevoking(true);
    setError(null);
    try {
      await api.revokeSharedLink(existingLink.id);
      setExistingLink(null);
      setPlainAccessCode(null);
      setExpiration(30);
      setAccessType('public');
      setAccessCode('');
      setAllowCopyCode(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('sharing.revokeError'));
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = async (text: string, onSuccess: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      onSuccess();
    }
  };

  const handleCopyLink = () => {
    if (!existingLink) return;
    copyToClipboard(existingLink.share_url, () => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleCopyAccessCode = () => {
    if (!plainAccessCode) return;
    copyToClipboard(plainAccessCode, () => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleGenerateAccessCode = () => {
    setAccessCode(generateAccessCode());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <div>
                <h3 id="share-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('sharing.title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[280px]" title={diagramTitle}>
                  {diagramTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label={t('sharing.closeModal')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {loadingLink ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-gray-500 dark:text-gray-400">{t('sharing.loading')}</span>
            </div>
          ) : existingLink ? (
            /* ===== Existing Link View ===== */
            <>
              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sharing.sharedLink')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={existingLink.share_url}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm focus:outline-none"
                    aria-label={t('sharing.sharedLinkAria')}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors flex items-center gap-1"
                    aria-label={t('sharing.copyLink')}
                  >
                    {linkCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('sharing.copied')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        {t('sharing.copy')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Access code (if protected) */}
              {existingLink.access_type === 'protected' && plainAccessCode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sharing.accessCode')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={plainAccessCode}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-mono tracking-wider focus:outline-none"
                      aria-label={t('sharing.accessCode')}
                    />
                    <button
                      onClick={handleCopyAccessCode}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                      aria-label={t('sharing.copyAccessCode')}
                    >
                      {codeCopied ? (
                        <>
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t('sharing.copied')}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t('sharing.copy')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Link info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('sharing.accessTypeLabel')}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {existingLink.access_type === 'public' ? t('sharing.accessPublic') : t('sharing.accessProtected')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('sharing.copyCodeLabel')}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {existingLink.allow_copy_code ? t('sharing.allowed') : t('sharing.notAllowed')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('sharing.createdAt')}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {formatDate(existingLink.created_at)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{t('sharing.expiresAt')}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {existingLink.expires_at ? formatDate(existingLink.expires_at) : t('sharing.never')}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            /* ===== Create New Link Form ===== */
            <>
              {/* Expiration selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sharing.linkExpiration')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {expirationOptions.map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setExpiration(opt.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        expiration === opt.value
                          ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                      aria-pressed={expiration === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Access type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sharing.accessTypeLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccessType('public')}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                      accessType === 'public'
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    aria-pressed={accessType === 'public'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('sharing.accessPublic')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccessType('protected');
                      if (!accessCode) handleGenerateAccessCode();
                    }}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                      accessType === 'protected'
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    aria-pressed={accessType === 'protected'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('sharing.accessProtected')}
                  </button>
                </div>
              </div>

              {/* Access code field (only if protected) */}
              {accessType === 'protected' && (
                <div>
                  <label htmlFor="access-code-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('sharing.accessCodeInput')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="access-code-input"
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder={t('sharing.accessCodePlaceholder')}
                      maxLength={20}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono tracking-wider placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAccessCode}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                      aria-label={t('sharing.generateCodeAria')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('sharing.generateCode')}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('sharing.accessCodeHint')}
                  </p>
                </div>
              )}

              {/* Allow copy code toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="allow-copy-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('sharing.allowCopyCode')}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('sharing.allowCopyCodeDesc')}
                  </p>
                </div>
                <button
                  id="allow-copy-toggle"
                  type="button"
                  role="switch"
                  aria-checked={allowCopyCode}
                  onClick={() => setAllowCopyCode(!allowCopyCode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    allowCopyCode ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowCopyCode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700">
          {existingLink ? (
            <>
              <button
                onClick={handleRevokeLink}
                disabled={revoking}
                className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {revoking && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {revoking ? t('sharing.revoking') : t('sharing.revokeLink')}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t('sharing.close')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('sharing.cancel')}
              </button>
              <button
                onClick={handleGenerateLink}
                disabled={loading || (accessType === 'protected' && accessCode.length > 0 && accessCode.length < 4)}
                className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? t('sharing.generating') : t('sharing.generateLink')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDiagramModal;
