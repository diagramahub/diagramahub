import { useState, useRef, useEffect, KeyboardEvent, ReactNode } from 'react';
import { ChatMode } from '../types/chat';
import { UserAISettings, AIProviderType, AI_PROVIDER_NAMES, AI_PROVIDER_MODELS } from '../types/ai';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  activeMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  aiSettings?: UserAISettings | null;
  activeProvider: AIProviderType | null;
  activeModel: string | null;
  onModelChange: (provider: AIProviderType, model: string) => void;
}

const MODES: { value: ChatMode; label: string; description: string; icon: ReactNode }[] = [
  {
    value: 'improvement',
    label: 'Edición',
    description: 'Modifica y mejora el diagrama',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    value: 'conversation',
    label: 'Analizar',
    description: 'Conversa sobre el diagrama',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

export default function ChatInput({ onSend, disabled = false, activeMode, onModeChange, aiSettings, activeProvider, activeModel, onModelChange }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);

  const currentMode = MODES.find((m) => m.value === activeMode) || MODES[1];

  // Proveedores activos del usuario
  const activeProviders = aiSettings?.providers?.filter((p) => p.is_active) || [];

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
      if (providerMenuRef.current && !providerMenuRef.current.contains(e.target as Node)) {
        setShowProviderMenu(false);
      }
    };
    if (showModeMenu || showProviderMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModeMenu, showProviderMenu]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* Textarea + send */}
      <div className="flex items-end gap-2 px-3 pt-3 pb-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
          style={{ maxHeight: '120px' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="p-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Enviar mensaje"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Footer: mode selector + provider selector */}
      <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
        {/* Mode selector */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => { setShowModeMenu(!showModeMenu); setShowProviderMenu(false); }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
          >
            {currentMode.icon}
            <span className="font-medium">{currentMode.label}</span>
            <svg className={`w-3 h-3 text-gray-400 transition-transform ${showModeMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Dropdown hacia arriba */}
          {showModeMenu && (
            <div className="absolute bottom-full left-0 mb-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => { onModeChange(mode.value); setShowModeMenu(false); }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    activeMode === mode.value ? 'bg-purple-50' : ''
                  }`}
                >
                  <span className={`mt-0.5 ${activeMode === mode.value ? 'text-purple-600' : 'text-gray-400'}`}>
                    {mode.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${activeMode === mode.value ? 'text-purple-700' : 'text-gray-700'}`}>
                        {mode.label}
                      </span>
                      {activeMode === mode.value && (
                        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{mode.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Provider selector */}
        {activeProviders.length > 0 && (
          <div className="relative" ref={providerMenuRef}>
            <button
              type="button"
              onClick={() => { setShowProviderMenu(!showProviderMenu); setShowModeMenu(false); }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              {activeProvider && (
                <img
                  src={`/images/ai-providers/${activeProvider}.svg`}
                  alt={activeProvider}
                  className="w-3.5 h-3.5 object-contain"
                />
              )}
              <span className="font-medium truncate max-w-[120px]">
                {activeModel || (activeProvider ? AI_PROVIDER_NAMES[activeProvider] : 'Modelo')}
              </span>
              <svg className={`w-3 h-3 text-gray-400 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {/* Provider/model dropdown hacia arriba */}
            {showProviderMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 max-h-72 overflow-y-auto">
                {activeProviders.map((p) => {
                  const models = AI_PROVIDER_MODELS[p.provider] || [{ id: p.model }];
                  return (
                    <div key={p.provider}>
                      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-100">
                        <img
                          src={`/images/ai-providers/${p.provider}.svg`}
                          alt={p.provider}
                          className="w-3.5 h-3.5 object-contain opacity-60"
                        />
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                          {AI_PROVIDER_NAMES[p.provider]}
                        </span>
                      </div>
                      {models.map((m) => {
                        const isSelected = activeProvider === p.provider && activeModel === m.id;
                        return (
                          <button
                            key={`${p.provider}-${m.id}`}
                            type="button"
                            onClick={() => { onModelChange(p.provider, m.id); setShowProviderMenu(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors ${
                              isSelected ? 'bg-purple-50' : ''
                            }`}
                          >
                            <span className={`text-xs truncate ${isSelected ? 'text-purple-700 font-medium' : 'text-gray-600'}`}>
                              {m.id}
                            </span>
                            {m.recommended && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 text-purple-700 rounded-full">
                                Recomendado
                              </span>
                            )}
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
