import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAISettings, AIProviderType, AI_PROVIDER_NAMES, AI_PROVIDER_MODELS } from '../types/ai';
import { ChatPresetAction } from '../types/chat';
import { PromptHistoryMenu } from './PromptHistoryMenu';
import Tooltip from './Tooltip';
import { modelReadsImages } from '../utils/imageInput';

interface ChatInputProps {
  onSend: (message: string, presetAction?: ChatPresetAction) => void;
  disabled?: boolean;
  aiSettings?: UserAISettings | null;
  activeProvider: AIProviderType | null;
  activeModel: string | null;
  onModelChange: (provider: AIProviderType, model: string) => void;
  /** Opens the "diagram from image" dialog; the button is hidden without it. */
  onImageToDiagram?: () => void;
}

export default function ChatInput({ onSend, disabled = false, aiSettings, activeProvider, activeModel, onModelChange, onImageToDiagram }: ChatInputProps) {
  const { t } = useTranslation();
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

  const handleQuickAction = (action: ChatPresetAction) => {
    if (disabled) return;
    const actionPrompts: Record<ChatPresetAction, string> = {
      explain: t('chat.quickActions.explainPrompt'),
      improve_ui: t('chat.quickActions.improveUiPrompt'),
      improve_process: t('chat.quickActions.improveProcessPrompt'),
      fix: t('chat.quickActions.fixPrompt'),
    };
    onSend(actionPrompts[action], action);
  };

  const canSend = text.trim().length > 0 && !disabled;
  // "From image" needs a model that reads images (the one picked below).
  const readsImages = modelReadsImages(activeProvider, activeModel);

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <div
        className="flex flex-nowrap gap-2 px-3 pt-3 pb-5 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <button
          type="button"
          onClick={() => handleQuickAction('explain')}
          disabled={disabled}
          className="flex-shrink-0 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
        >
          {t('chat.quickActions.explain')}
        </button>
        <button
          type="button"
          onClick={() => handleQuickAction('improve_ui')}
          disabled={disabled}
          className="flex-shrink-0 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
        >
          {t('chat.quickActions.improveUi')}
        </button>
        <button
          type="button"
          onClick={() => handleQuickAction('improve_process')}
          disabled={disabled}
          className="flex-shrink-0 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
        >
          {t('chat.quickActions.improveProcess')}
        </button>
        <button
          type="button"
          onClick={() => handleQuickAction('fix')}
          disabled={disabled}
          className="flex-shrink-0 whitespace-nowrap px-2 py-1 text-xs font-medium rounded-full border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 transition-colors"
        >
          {t('chat.quickActions.fix')}
        </button>
      </div>

      {/* Textarea + send */}
      <div className="flex items-end gap-2 px-3 pt-3 pb-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="input h-auto py-2 flex-1 resize-none disabled:opacity-50 disabled:bg-gray-50"
          style={{ maxHeight: '120px' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="p-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label={t('chat.sendMessage')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Footer: prompt history + provider selector */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-0.5">
        <div className="flex items-center gap-1">
          <PromptHistoryMenu
            disabled={disabled}
            onSelect={(prompt) => {
              setText(prompt);
              textareaRef.current?.focus();
            }}
          />
          {onImageToDiagram && (
            <Tooltip content={readsImages ? t('imageToDiagram.buttonHint') : t('imageToDiagram.needsImageModel')}>
            <button
              type="button"
              onClick={onImageToDiagram}
              disabled={disabled || !readsImages}
              aria-describedby={readsImages ? undefined : 'image-model-hint'}
              className="flex items-center gap-1.5 px-2 py-1 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{t('imageToDiagram.button')}</span>
            </button>
            </Tooltip>
          )}
          {onImageToDiagram && !readsImages && (
            <span id="image-model-hint" className="sr-only">{t('imageToDiagram.needsImageModel')}</span>
          )}
        </div>
        {/* Provider selector */}
        {activeProviders.length > 0 && (
          <div className="relative" ref={providerMenuRef}>
            <button
              type="button"
              onClick={() => { setShowProviderMenu(!showProviderMenu); }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              {activeProvider && (
                <img
                  src={`/images/ai-providers/${activeProvider}.svg`}
                  alt={activeProvider}
                  className="w-3.5 h-3.5 object-contain"
                />
              )}
              <span className="font-medium truncate max-w-[120px]">
                {activeModel || (activeProvider ? AI_PROVIDER_NAMES[activeProvider] : t('chat.model'))}
              </span>
              <svg className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {/* Provider/model dropdown hacia arriba */}
            {showProviderMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-30 py-1 max-h-72 overflow-y-auto">
                {activeProviders.map((p) => {
                  const models = AI_PROVIDER_MODELS[p.provider] || [{ id: p.model }];
                  return (
                    <div key={p.provider}>
                      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
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
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                              isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                          >
                            <span className={`text-xs truncate ${isSelected ? 'text-purple-700 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {m.id}
                            </span>
                            {m.images && (
                              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label={t('chat.readsImages')}>
                                <title>{t('chat.readsImages')}</title>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                            {m.recommended && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                                {t('chat.recommended')}
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
