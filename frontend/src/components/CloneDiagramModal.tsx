import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface CloneDiagramModalProps {
  isOpen: boolean;
  diagramName: string;
  onClose: () => void;
  onConfirm: (title: string) => Promise<void>;
}

export default function CloneDiagramModal({
  isOpen,
  diagramName,
  onClose,
  onConfirm,
}: CloneDiagramModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsCloning(false);
      return;
    }

    // Suggest "<name>-copia" / "<name>-copy" according to the UI language
    setTitle(`${diagramName}${t("editor.duplicateSuffix")}`);
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCloning) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, diagramName, t, onClose, isCloning]);

  if (!isOpen) return null;

  const trimmedTitle = title.trim();
  const canConfirm = trimmedTitle.length > 0 && !isCloning;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsCloning(true);
    try {
      await onConfirm(trimmedTitle);
    } finally {
      setIsCloning(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canConfirm) void handleConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("editor.duplicateDiagramTitle")}
          </h3>
          <button
            onClick={onClose}
            disabled={isCloning}
            aria-label={t("common.cancel")}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("editor.duplicateDiagramDescription", { diagramName })}
          </p>
          <div>
            <label
              htmlFor="clone-diagram-title"
              className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5"
            >
              {t("editor.duplicateNameLabel")}
            </label>
            <input
              id="clone-diagram-title"
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              disabled={isCloning}
              className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isCloning ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t("editor.duplicatingDiagram")}
                </span>
              ) : (
                t("editor.duplicateConfirm")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
