import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "../types/project";

interface MoveDiagramModalProps {
  isOpen: boolean;
  diagramName: string;
  projects: Project[];
  currentProjectId: string;
  isLoadingProjects: boolean;
  onClose: () => void;
  onConfirm: (targetProjectId: string) => Promise<void>;
}

export default function MoveDiagramModal({
  isOpen,
  diagramName,
  projects,
  currentProjectId,
  isLoadingProjects,
  onClose,
  onConfirm,
}: MoveDiagramModalProps) {
  const { t } = useTranslation();
  const [targetProjectId, setTargetProjectId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const availableProjects = projects.filter((project) => project.id !== currentProjectId);

  useEffect(() => {
    if (!isOpen) {
      setTargetProjectId("");
      setIsMoving(false);
      return;
    }

    selectRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isMoving) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isMoving, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!targetProjectId) return;

    setIsMoving(true);
    try {
      await onConfirm(targetProjectId);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-diagram-title"
      >
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 id="move-diagram-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("editor.moveDiagram")}
          </h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("editor.moveDiagramDescription", { diagramName })}
          </p>
          <div>
            <label htmlFor="target-project" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("editor.targetProject")}
            </label>
            <select
              id="target-project"
              ref={selectRef}
              value={targetProjectId}
              onChange={(event) => setTargetProjectId(event.target.value)}
              disabled={isLoadingProjects || isMoving || availableProjects.length === 0}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">{t("editor.selectTargetProject")}</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.emoji} {project.name}
                </option>
              ))}
            </select>
            {!isLoadingProjects && availableProjects.length === 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("editor.noOtherProjects")}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 rounded-b-lg bg-gray-50 px-6 py-4 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isMoving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!targetProjectId || isMoving}
            className="bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isMoving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isMoving ? t("editor.movingDiagram") : t("editor.moveDiagram")}
          </button>
        </div>
      </div>
    </div>
  );
}
