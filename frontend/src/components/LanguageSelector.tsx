import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'es', name: 'Español', flag: '🇲🇽' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
];

interface LanguageSelectorProps {
  /**
   * Flag-only trigger for the collapsed sidebar. The menu is portaled to <body>
   * so it can overflow the narrow sidebar without any panel covering it.
   */
  compact?: boolean;
}

export default function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, bottom: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('language', languageCode);
    setIsOpen(false);
  };

  const toggle = () => {
    if (!isOpen && compact && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Opens above the trigger (like the expanded selector), so the tooltip that
      // appears to the right of the trigger never covers it.
      setMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside (the compact menu lives in a portal) or on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const options = languages.map((language) => (
    <button
      key={language.code}
      role="menuitemradio"
      aria-checked={currentLanguage.code === language.code}
      onClick={() => handleLanguageChange(language.code)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${currentLanguage.code === language.code ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-200'
        }`}
    >
      <span className="text-lg">{language.flag}</span>
      <span className="font-medium">{language.name}</span>
      {currentLanguage.code === language.code && (
        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  ));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={`w-full flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
          compact ? 'justify-center px-3 py-2' : 'gap-2 px-3 py-2'
        }`}
        title={compact ? undefined : t('sidebar.language')}
        aria-label={`${t('sidebar.language')}: ${currentLanguage.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="text-lg leading-none">{currentLanguage.flag}</span>
        {!compact && (
          <>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage.name}
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && !compact && (
        <div role="menu" className="absolute left-0 bottom-full mb-2 w-full bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-50">
          {options}
        </div>
      )}

      {isOpen && compact && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-44 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-[9999]"
          style={{ left: menuPos.left, bottom: menuPos.bottom }}
        >
          {options}
        </div>,
        document.body,
      )}
    </div>
  );
}
