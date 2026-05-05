import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { UserAISettings, AIProviderType, AI_PROVIDER_NAMES, AI_PROVIDER_MODELS } from '../types/ai';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  aiSettings?: UserAISettings | null;
  activeProvider: AIProviderType | null;
  activeModel: string | null;
  onModelChange: (provider: AIProviderType, model: string) => void;
}

export default function ChatInput({ onSend, disabled = false, aiSettings, activeProvider, activeModel, onModelChange }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);

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
      if (providerMenuRef.current && !providerMenuRef.current.contains(e.target as Node)) {
        setShowProviderMenu(false);
      }
    };
    if (showProviderMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProviderMenu]);

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
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      {/* Textarea + send */}
      <div className="flex items-end gap-2 px-3 pt-3 pb-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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

      {/* Footer: provider selector */}
      <div className="flex items-center justify-end px-3 pb-2 pt-0.5">
        {/* Provider selector */}
        {activeProviders.length > 0 && (
          <div className="relative" ref={providerMenuRef}>
            <button
              type="button"
              onClick={() => { setShowProviderMenu(!showProviderMenu); }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
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
              <svg className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {/* Provider/model dropdown hacia arriba */}
            {showProviderMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 py-1 max-h-72 overflow-y-auto">
                {activeProviders.map((p) => {
                  const models = AI_PROVIDER_MODELS[p.provider] || [{ id: p.model }];
                  return (
                    <div key={p.provider}>
                      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700">
                        <img
                          src={`/images/ai-providers/${p.provider}.svg`}
                          alt={p.provider}
                          className="w-3.5 h-3.5 object-contain opacity-60"
                        />
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
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
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                              isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                          >
                            <span className={`text-xs truncate ${isSelected ? 'text-purple-700 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {m.id}
                            </span>
                            {m.recommended && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                                Recomendado
                              </span>
                            )}
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
