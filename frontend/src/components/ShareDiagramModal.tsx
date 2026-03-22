import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { SharedLink, CreateSharedLinkRequest } from '../types/sharing';

interface ShareDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
  diagramTitle: string;
}

type ExpirationOption = 5 | 10 | 30 | null;

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: 5, label: '5 días' },
  { value: 10, label: '10 días' },
  { value: 30, label: '30 días' },
  { value: null, label: 'Ilimitado' },
];

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ShareDiagramModal: React.FC<ShareDiagramModalProps> = ({
  isOpen,
  onClose,
  diagramId,
  diagramTitle,
}) => {
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
        // Populate form with existing config
        setAccessType(link.access_type);
        setAllowCopyCode(link.allow_copy_code);
        if (link.access_code) {
          setPlainAccessCode(link.access_code);
        }
      } else {
        // No active link exists — show the create form
        setExistingLink(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setExistingLink(null);
      } else {
        setError('Error al cargar el enlace compartido');
      }
    } finally {
      setLoadingLink(false);
    }
  }, [diagramId]);

  // Load existing link when modal opens
  useEffect(() => {
    if (isOpen && diagramId) {
      fetchExistingLink();
    }
    if (!isOpen) {
      // Reset state when modal closes
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
      setError(typeof detail === 'string' ? detail : 'Error al generar el enlace');
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
      setError(typeof detail === 'string' ? detail : 'Error al revocar el enlace');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyLink = async () => {
    if (!existingLink) return;
    try {
      await navigator.clipboard.writeText(existingLink.share_url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = existingLink.share_url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleCopyAccessCode = async () => {
    if (!plainAccessCode) return;
    try {
      await navigator.clipboard.writeText(plainAccessCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = plainAccessCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleGenerateAccessCode = () => {
    setAccessCode(generateAccessCode());
  };

  // Handle Escape key
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <div>
                <h3 id="share-modal-title" className="text-lg font-semibold text-gray-900">
                  Compartir diagrama
                </h3>
                <p className="text-sm text-gray-500 truncate max-w-[280px]" title={diagramTitle}>
                  {diagramTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cerrar modal"
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
              <span className="ml-2 text-gray-500">Cargando...</span>
            </div>
          ) : existingLink ? (
            /* ===== Existing Link View ===== */
            <>
              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enlace compartido
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={existingLink.share_url}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm focus:outline-none"
                    aria-label="URL del enlace compartido"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1 btn-glass"
                    aria-label="Copiar enlace"
                  >
                    {linkCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copiado
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Access code (if protected) */}
              {existingLink.access_type === 'protected' && plainAccessCode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código de acceso
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={plainAccessCode}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm font-mono tracking-wider focus:outline-none"
                      aria-label="Código de acceso"
                    />
                    <button
                      onClick={handleCopyAccessCode}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                      aria-label="Copiar código de acceso"
                    >
                      {codeCopied ? (
                        <>
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copiado
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Link info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tipo de acceso</span>
                  <span className="font-medium text-gray-700">
                    {existingLink.access_type === 'public' ? 'Público' : 'Protegido con código'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Copiar código</span>
                  <span className="font-medium text-gray-700">
                    {existingLink.allow_copy_code ? 'Permitido' : 'No permitido'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Creado</span>
                  <span className="font-medium text-gray-700">
                    {formatDate(existingLink.created_at)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expira</span>
                  <span className="font-medium text-gray-700">
                    {existingLink.expires_at ? formatDate(existingLink.expires_at) : 'Nunca'}
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            /* ===== Create New Link Form ===== */
            <>
              {/* Expiration selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vigencia del enlace
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setExpiration(opt.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        expiration === opt.value
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de acceso
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccessType('public')}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                      accessType === 'public'
                        ? 'bg-purple-100 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={accessType === 'public'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Público
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccessType('protected');
                      if (!accessCode) handleGenerateAccessCode();
                    }}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                      accessType === 'protected'
                        ? 'bg-purple-100 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={accessType === 'protected'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Protegido con código
                  </button>
                </div>
              </div>

              {/* Access code field (only if protected) */}
              {accessType === 'protected' && (
                <div>
                  <label htmlFor="access-code-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Código de acceso
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="access-code-input"
                      type="text"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Ingresa o genera un código"
                      maxLength={20}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm font-mono tracking-wider placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAccessCode}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                      aria-label="Generar código automáticamente"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generar
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo 4 caracteres. Si lo dejas vacío, se generará uno automáticamente.
                  </p>
                </div>
              )}

              {/* Allow copy code toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="allow-copy-toggle" className="text-sm font-medium text-gray-700">
                    Permitir copiar código del diagrama
                  </label>
                  <p className="text-xs text-gray-500">
                    Los visitantes podrán copiar el código fuente
                  </p>
                </div>
                <button
                  id="allow-copy-toggle"
                  type="button"
                  role="switch"
                  aria-checked={allowCopyCode}
                  onClick={() => setAllowCopyCode(!allowCopyCode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    allowCopyCode ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowCopyCode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex gap-3 justify-end">
          {existingLink ? (
            <>
              <button
                onClick={handleRevokeLink}
                disabled={revoking}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {revoking && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {revoking ? 'Revocando...' : 'Revocar enlace'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateLink}
                disabled={loading || (accessType === 'protected' && accessCode.length > 0 && accessCode.length < 4)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 btn-glass"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? 'Generando...' : 'Generar enlace'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDiagramModal;
