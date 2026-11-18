import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SimpleMDE from "react-simplemde-editor";
import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const text = (label: string) => `<span class="mde-text-icon" aria-hidden="true">${label}</span>`;

// Inline icons: EasyMDE's default ones need Font Awesome from a CDN, which the
// Content Security Policy blocks (the toolbar used to render blank).
const TOOLBAR: { name: string; action: (editor: EasyMDE) => void; icon: string; noDisable?: boolean; noMobile?: boolean }[][] = [
  [
    { name: "bold", action: EasyMDE.toggleBold, icon: svg("M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z") },
    { name: "italic", action: EasyMDE.toggleItalic, icon: svg("M19 4h-9M14 20H5M15 4 9 20") },
    { name: "strikethrough", action: EasyMDE.toggleStrikethrough, icon: svg("M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16") },
  ],
  [
    { name: "heading-1", action: EasyMDE.toggleHeading1, icon: text("H1") },
    { name: "heading-2", action: EasyMDE.toggleHeading2, icon: text("H2") },
    { name: "heading-3", action: EasyMDE.toggleHeading3, icon: text("H3") },
  ],
  [
    { name: "unordered-list", action: EasyMDE.toggleUnorderedList, icon: svg("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01") },
    { name: "ordered-list", action: EasyMDE.toggleOrderedList, icon: svg("M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1") },
  ],
  [
    { name: "code", action: EasyMDE.toggleCodeBlock, icon: svg("m16 18 6-6-6-6M8 6l-6 6 6 6") },
    { name: "quote", action: EasyMDE.toggleBlockquote, icon: svg("M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6") },
    { name: "link", action: EasyMDE.drawLink, icon: svg("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71") },
    { name: "table", action: EasyMDE.drawTable, icon: svg("M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M3 15h18M9 3v18") },
  ],
  [{ name: "horizontal-rule", action: EasyMDE.drawHorizontalRule, icon: svg("M5 12h14") }],
  [
    { name: "preview", action: EasyMDE.togglePreview, icon: svg("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"), noDisable: true },
    { name: "side-by-side", action: EasyMDE.toggleSideBySide, icon: svg("M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 3v18"), noDisable: true, noMobile: true },
  ],
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  maxLength?: number;
  /** Open in edit mode instead of the rendered preview. */
  startEditing?: boolean;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className = "",
  fontSize,
  maxLength,
  startEditing = false,
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const { t } = useTranslation();
  const editorPlaceholder = placeholder ?? t("markdownEditor.placeholder");

  const handleChange = useCallback(
    (val: string) => {
      if (maxLength && val.length > maxLength) {
        return;
      }
      onChange(val);
    },
    [onChange, maxLength],
  );

  const easymdeOptions = useMemo(
    () => ({
      spellChecker: false,
      placeholder: editorPlaceholder,
      status: false,
      minHeight: "300px",
      autofocus: true,
      autoDownloadFontAwesome: false,
      toolbar: TOOLBAR.flatMap((group, index) => [
        ...(index ? (["|"] as const) : []),
        ...group.map((button) => ({ ...button, className: "mde-icon", title: t(`markdownEditor.toolbar.${button.name}`) })),
      ]),
    }),
    [editorPlaceholder, t],
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {isEditing ? (
        <>
          {/* Edit mode header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {t("markdownEditor.editing")}
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t("markdownEditor.done")}
            </button>
          </div>
          {/* EasyMDE WYSIWYG */}
          <div className="flex-1 overflow-auto markdown-wysiwyg">
            <SimpleMDE
              value={value}
              onChange={handleChange}
              options={easymdeOptions}
            />
          </div>
        </>
      ) : (
        <>
          {/* Read-only mode header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {t('editor.description')}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
              title={t('editor.editDescription')}
              aria-label={t('editor.editDescription')}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t("markdownEditor.edit")}
            </button>
          </div>
          {/* Markdown preview */}
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
            <div
              className="prose prose-sm max-w-none p-4 text-gray-800 dark:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-code:text-purple-700 dark:prose-code:text-purple-300 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/30 prose-code:px-1 prose-code:rounded prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700"
              style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                  <svg
                    className="w-10 h-10 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm italic">{t("markdownEditor.empty")}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
                  >
                    {t("markdownEditor.add")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
