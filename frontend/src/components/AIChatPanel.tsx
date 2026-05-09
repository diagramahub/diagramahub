import { useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../services/api';
import { ChatSession, ChatMessage } from '../types/chat';
import { UserAISettings, AIProviderType } from '../types/ai';
import ChatSessionSelector from './ChatSessionSelector';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import DiagramPreview from './DiagramPreview';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  diagramCode: string;
  diagramType: string;
  diagramId: string;
  onAcceptImprovement: (code: string) => void;
  aiSettings?: UserAISettings | null;
  preferredProvider?: string | null;
  preferredModel?: string | null;
  onPreferredModelChange?: (provider: string, model: string) => void;
}

export default function AIChatPanel({
  isOpen,
  onClose,
  diagramCode,
  diagramType,
  diagramId,
  onAcceptImprovement,
  aiSettings,
  preferredProvider: preferredProviderProp,
  preferredModel: preferredModelProp,
  onPreferredModelChange,
}: AIChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [compactionNotice, setCompactionNotice] = useState('');

  // Estado para modal de preview expandido
  const [expandedPreview, setExpandedPreview] = useState<{ code: string; diagramType: string } | null>(null);

  // Estado para panel redimensionable
  const [panelWidth, setPanelWidth] = useState(400);
  const isResizing = useRef(false);

  // Estado para proveedor activo
  const [activeProvider, setActiveProvider] = useState<AIProviderType | null>(
    (preferredProviderProp as AIProviderType) || aiSettings?.default_provider || null
  );
  const [activeModel, setActiveModel] = useState<string | null>(
    preferredModelProp || null
  );

  // Mobile keyboard handling — adjust height when virtual keyboard opens
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => {
      setViewportHeight(window.visualViewport!.height);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // Sincronizar proveedor cuando cambian aiSettings
  useEffect(() => {
    if (aiSettings?.default_provider && !activeProvider) {
      setActiveProvider(aiSettings.default_provider);
      // Setear modelo por defecto del proveedor configurado
      const defaultConfig = aiSettings.providers?.find(
        (p) => p.provider === aiSettings.default_provider && p.is_active
      );
      if (defaultConfig && !activeModel) {
        setActiveModel(defaultConfig.model);
      }
    }
  }, [aiSettings]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // El panel está a la derecha, así que mover a la izquierda agranda
      const delta = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 320), 700);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isFinalized = activeSession?.status === 'finalized';

  // Cargar sesiones al abrir el panel
  const loadSessions = useCallback(async () => {
    if (!diagramId) return;
    try {
      const data = await apiService.getChatSessions(diagramId);
      setSessions(data);
      return data;
    } catch {
      setError('Error al cargar sesiones');
      return [];
    }
  }, [diagramId]);

  // Cargar mensajes de una sesión
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const data = await apiService.getChatSessionWithMessages(sessionId);
      setMessages(data.messages);
    } catch {
      setError('Error al cargar mensajes');
    }
  }, []);

  // Inicializar: cargar sesiones y seleccionar la más reciente o crear nueva
  useEffect(() => {
    if (!isOpen || !diagramId) return;
    const init = async () => {
      const data = await loadSessions();
      if (!data || data.length === 0) {
        await handleCreateSession();
      } else {
        const mostRecent = data[0]; // ya vienen ordenadas por updated_at desc
        setActiveSessionId(mostRecent.id);
        await loadMessages(mostRecent.id);
        // Prioridad: preferencia del diagrama > sesión > aiSettings
        if (preferredProviderProp && preferredModelProp) {
          setActiveProvider(preferredProviderProp as AIProviderType);
          setActiveModel(preferredModelProp);
        } else if (mostRecent.last_provider && mostRecent.last_model) {
          setActiveProvider(mostRecent.last_provider as AIProviderType);
          setActiveModel(mostRecent.last_model);
          // Propagate session's provider to diagram preferences
          onPreferredModelChange?.(mostRecent.last_provider, mostRecent.last_model);
        }
      }
    };
    init();
  }, [isOpen, diagramId]);

  // Crear nueva sesión
  const handleCreateSession = async () => {
    if (!diagramId) return;
    try {
      const session = await apiService.createChatSession({ diagram_id: diagramId });
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
    } catch {
      setError('Error al crear sesión');
    }
  };

  // Cambiar sesión activa
  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    setError('');
    setCompactionNotice('');
    await loadMessages(sessionId);

    // Restaurar proveedor/modelo de la sesión
    const session = sessions.find((s) => s.id === sessionId);
    if (session?.last_provider && session?.last_model) {
      setActiveProvider(session.last_provider as AIProviderType);
      setActiveModel(session.last_model);
      // Propagate to diagram preferences
      onPreferredModelChange?.(session.last_provider, session.last_model);
    }
  };

  // Eliminar sesión
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiService.deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          await handleSelectSession(remaining[0].id);
        } else {
          await handleCreateSession();
        }
      }
    } catch {
      setError('Error al eliminar sesión');
    }
  };

  // Renombrar sesión
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const updated = await apiService.updateChatSessionTitle(sessionId, { title: newTitle });
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s)));
    } catch {
      setError('Error al renombrar sesión');
    }
  };

  // Cambiar modelo activo y persistir en la sesión
  const handleModelChange = async (provider: AIProviderType, model: string) => {
    setActiveProvider(provider);
    setActiveModel(model);
    // Propagar al diagrama para persistir preferencia
    onPreferredModelChange?.(provider, model);
    if (activeSessionId) {
      try {
        await apiService.updateChatSessionModel(activeSessionId, { provider, model });
        setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, last_provider: provider, last_model: model } : s));
      } catch {
        // No bloquear la UI si falla el guardado
      }
    }
  };

  // Enviar mensaje
  const handleSendMessage = async (content: string) => {
    if (!activeSessionId || isFinalized) return;

    // Agregar mensaje del usuario de forma optimista
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: activeSessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setIsLoading(true);
    setError('');
    setCompactionNotice('');
    try {
      const aiMessage = await apiService.sendChatMessage(activeSessionId, {
        content,
        diagram_code: diagramCode,
        diagram_type: diagramType,
        provider: activeProvider || aiSettings?.default_provider || undefined,
        model: activeModel || undefined,
        language: 'es',
      });

      // Si la respuesta viene de una sesión diferente (compactación), actualizar
      if (aiMessage.session_id !== activeSessionId) {
        setCompactionNotice('Se creó una nueva sesión por límite de contexto');
        setActiveSessionId(aiMessage.session_id);
        await loadSessions();
        await loadMessages(aiMessage.session_id);
      } else {
        // Recargar mensajes para obtener tanto el del usuario real como la respuesta de IA
        await loadMessages(activeSessionId);
        // Actualizar sesiones (el título puede haber cambiado)
        await loadSessions();
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(typeof detail === 'string' ? detail : 'Error al enviar mensaje');
      } else {
        setError('Error de red al enviar mensaje');
      }
      // Recargar mensajes por si se guardó el mensaje de error
      if (activeSessionId) await loadMessages(activeSessionId);
    } finally {
      setIsLoading(false);
    }
  };

  // Aceptar mejora
  const handleAcceptImprovement = async (messageId: string, code: string) => {
    if (!activeSessionId) return;
    try {
      await apiService.updateMessageStatus(activeSessionId, messageId, { status: 'accepted' });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, improvement_status: 'accepted' } : m))
      );
      onAcceptImprovement(code);
    } catch {
      setError('Error al aceptar mejora');
    }
  };

  // Rechazar mejora
  const handleRejectImprovement = async (messageId: string) => {
    if (!activeSessionId) return;
    try {
      await apiService.updateMessageStatus(activeSessionId, messageId, { status: 'rejected' });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, improvement_status: 'rejected' } : m))
      );
    } catch {
      setError('Error al rechazar mejora');
    }
  };

  // Reintentar mensaje de error
  const handleRetry = async (messageId: string) => {
    const errorMsg = messages.find((m) => m.id === messageId);
    if (!errorMsg) return;
    // Buscar el último mensaje del usuario antes del error
    const idx = messages.findIndex((m) => m.id === messageId);
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        await handleSendMessage(messages[i].content);
        return;
      }
    }
  };

  // Eliminar mensaje
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeSessionId) return;
    try {
      await apiService.deleteChatMessage(activeSessionId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Error al eliminar mensaje');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 sm:static sm:inset-auto flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 animate-slide-in-right overflow-hidden relative z-40 sm:z-auto"
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : panelWidth,
        // Adjust height for mobile keyboard: use visualViewport height when available
        ...(viewportHeight && window.innerWidth < 640 ? { height: viewportHeight } : {}),
        // Push input above the mobile bottom toolbar (h-14 = 56px)
        paddingBottom: typeof window !== 'undefined' && window.innerWidth < 640 ? '56px' : undefined,
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-300 dark:hover:bg-purple-600 active:bg-purple-400 dark:active:bg-purple-500 transition-colors z-10 hidden sm:block"
        title="Arrastrar para redimensionar"
      />
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat con IA
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Session selector */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <ChatSessionSelector
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      </div>

      {/* Compaction notice */}
      {compactionNotice && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-700 flex-shrink-0">
          <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {compactionNotice}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-700 flex-shrink-0">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Messages */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        diagramType={diagramType}
        onAccept={handleAcceptImprovement}
        onReject={handleRejectImprovement}
        onRetry={handleRetry}
        onDeleteMessage={handleDeleteMessage}
        onRestore={(code) => onAcceptImprovement(code)}
        onExpandPreview={(code, dt) => setExpandedPreview({ code, diagramType: dt })}
      />

      {/* Input */}
      {isFinalized ? (
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-center flex-shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Sesión finalizada (solo lectura)</p>
        </div>
      ) : (
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          aiSettings={aiSettings}
          activeProvider={activeProvider}
          activeModel={activeModel}
          onModelChange={handleModelChange}
        />
      )}

      {/* Modal de preview expandido */}
      {expandedPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setExpandedPreview(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vista previa del diagrama</span>
              <button
                type="button"
                onClick={() => setExpandedPreview(null)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <DiagramPreview code={expandedPreview.code} diagramType={expandedPreview.diagramType} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
