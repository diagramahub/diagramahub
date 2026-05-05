import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types/chat';
import DiagramPreviewInline from './DiagramPreviewInline';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  diagramType: string;
  onAccept?: (messageId: string, code: string) => void;
  onReject?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRestore?: (code: string) => void;
  onExpandPreview?: (code: string, diagramType: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  const date = new Date(normalized);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 30) return `hace ${diffDays}d`;
  return date.toLocaleDateString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
      title="Copiar contenido"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-500">Copiado</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}

export default function ChatMessageList({
  messages,
  isLoading,
  diagramType,
  onAccept,
  onReject,
  onRetry,
  onDeleteMessage,
  onRestore,
  onExpandPreview,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Auto-scroll al último mensaje
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="text-center">
          <svg className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Envía un mensaje para comenzar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          {/* Nombre del modelo para mensajes de assistant */}
          {msg.role === 'assistant' && msg.model_used && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 px-1 flex items-center gap-1">
              {msg.provider_used && (
                <img
                  src={`/images/ai-providers/${msg.provider_used}.svg`}
                  alt={msg.provider_used}
                  className="w-3 h-3 object-contain opacity-50"
                />
              )}
              {msg.model_used}
              {msg.generation_time != null && (
                <span className="text-gray-300 dark:text-gray-600">• {msg.generation_time.toFixed(1)}s</span>
              )}
            </span>
          )}

          <div
            className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : msg.role === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            {/* Botón eliminar */}
            {onDeleteMessage && (
              <button
                type="button"
                onClick={() => onDeleteMessage(msg.id)}
                className={`absolute -top-2 ${msg.role === 'user' ? '-left-2' : '-right-2'} p-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
                title="Eliminar mensaje"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {msg.role === 'assistant' && !msg.improved_code ? (
              <div className="chat-markdown break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            ) : msg.role === 'assistant' && msg.improved_code ? (
              <div className="chat-markdown break-words mb-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            ) : msg.role !== 'assistant' ? (
              <p className="whitespace-pre-wrap break-words">
                {msg.content}
              </p>
            ) : null}

            {/* Botón copiar para mensajes de assistant sin código de diagrama */}
            {msg.role === 'assistant' && !msg.improved_code && <CopyButton text={msg.content} />}

            {/* Preview de diagrama para mensajes de mejora */}
            {msg.role === 'assistant' && msg.improved_code && (
              <DiagramPreviewInline
                code={msg.improved_code}
                diagramType={diagramType}
                status={msg.improvement_status}
                onAccept={() => onAccept?.(msg.id, msg.improved_code!)}
                onReject={() => onReject?.(msg.id)}
                onRestore={() => onRestore?.(msg.improved_code!)}
                onExpand={() => onExpandPreview?.(msg.improved_code!, diagramType)}
              />
            )}

            {/* Botón reintentar para errores */}
            {msg.role === 'error' && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(msg.id)}
                className="mt-2 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                ↻ Reintentar
              </button>
            )}
          </div>

          {/* Timestamp */}
          <span className={`text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            {formatRelativeDate(msg.created_at)}
          </span>
        </div>
      ))}

      {/* Indicador de carga */}
      {isLoading && (
        <div className="flex items-start">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
