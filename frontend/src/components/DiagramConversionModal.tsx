/**
 * Modal for diagram type conversion with preview.
 * Shows the original code vs converted code side-by-side,
 * with warnings about potential incompatibilities.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConvertDiagramResponse } from "../types/ai";
import DiagramPreview from "./DiagramPreview";

interface DiagramConversionModalProps {
  conversionResult: ConvertDiagramResponse;
  onApply: () => void;
  onCancel: () => void;
}

export const DiagramConversionModal: React.FC<DiagramConversionModalProps> = ({
  conversionResult,
  onApply,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");

  const originalLines = conversionResult.original_code.split("\n");
  const convertedLines = conversionResult.converted_code.split("\n");
  const canApply = conversionResult.converted_code.trim().length > 0;

  const getFileExtension = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("plantuml") || t === "uml") return "puml";
    if (t === "d2") return "d2";
    if (t === "dbml") return "dbml";
    return "mmd";
  };

  const sourceExt = getFileExtension(conversionResult.source_type);
  const targetExt = getFileExtension(conversionResult.target_type);

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      mermaid: "Mermaid",
      plantuml: "PlantUML",
      d2: "D2",
      dbml: "DBML",
    };
    return labels[type.toLowerCase()] || type;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Conversion icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <svg
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t("conversion.modal.title")}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {getTypeLabel(conversionResult.source_type)} →{" "}
                  {getTypeLabel(conversionResult.target_type)}
                  <span className="ml-2 text-xs text-gray-400">
                    ({conversionResult.generation_time}s •{" "}
                    {conversionResult.model_used})
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label={t("common.close")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Warning banner */}
        {conversionResult.warning && (
          <div className="mx-6 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t("conversion.modal.warningTitle")}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  {conversionResult.warning}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* General incompatibility notice */}
        <div className="mx-6 mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t("conversion.modal.generalNotice")}
            </p>
          </div>
        </div>

        {/* View selector */}
        <div className="px-6 pt-4 flex gap-2" role="tablist">
          {(["preview", "code"] as const).map((view) => (
            <button
              key={view}
              role="tab"
              aria-selected={activeView === view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeView === view
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {t(`conversion.modal.${view}`)}
            </button>
          ))}
        </div>

        {/* Original and converted comparison */}
        <div className="flex-1 overflow-auto p-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2 gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("conversion.modal.original")} ({getTypeLabel(conversionResult.source_type)})
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                  {originalLines.length} {t("conversion.modal.lines")}
                </span>
              </div>
              {activeView === "preview" ? (
                <div className="h-[40vh] min-h-[280px]">
                  <DiagramPreview
                    code={conversionResult.original_code}
                    diagramType={conversionResult.source_type}
                  />
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm h-[40vh] min-h-[280px]">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 border-b border-gray-300 dark:border-gray-600">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      diagram.{sourceExt}
                    </span>
                  </div>
                  <pre className="overflow-auto p-3 h-[calc(40vh-34px)] min-h-[246px]">
                    <code className="block text-xs font-mono leading-relaxed text-gray-800 dark:text-gray-200">
                      {conversionResult.original_code}
                    </code>
                  </pre>
                </div>
              )}
            </section>

            <section className="flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-2 gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("conversion.modal.converted")} ({getTypeLabel(conversionResult.target_type)})
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                  {convertedLines.length} {t("conversion.modal.lines")}
                </span>
              </div>
              {activeView === "preview" ? (
                <div className="h-[40vh] min-h-[280px]">
                  <DiagramPreview
                    code={conversionResult.converted_code}
                    diagramType={conversionResult.target_type}
                  />
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-700 rounded-lg overflow-hidden shadow-sm h-[40vh] min-h-[280px]">
                  <div className="bg-green-50 dark:bg-green-900/30 px-3 py-1.5 border-b border-green-300 dark:border-green-700">
                    <span className="text-xs text-green-700 dark:text-green-400 font-mono">
                      diagram.{targetExt}
                    </span>
                  </div>
                  <pre className="overflow-auto p-3 h-[calc(40vh-34px)] min-h-[246px]">
                    <code className="block text-xs font-mono leading-relaxed text-green-900 dark:text-green-200">
                      {conversionResult.converted_code}
                    </code>
                  </pre>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("conversion.modal.footerNote")}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 font-medium text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={onApply}
              disabled={!canApply}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white btn-glass rounded-lg transition-colors duration-200 font-medium text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("conversion.modal.applyConversion")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
