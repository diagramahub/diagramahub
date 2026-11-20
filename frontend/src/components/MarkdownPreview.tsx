import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tone = 'default' | 'invert';

/** Shared look of rendered descriptions: headings, lists, tables, quotes and inline code as a chip. */
const BLOCK_CLASSES: Record<Tone, string> = {
  default:
    'prose prose-sm max-w-none break-words text-gray-700 dark:text-gray-300 dark:prose-invert ' +
    'prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 ' +
    'prose-a:text-purple-600 dark:prose-a:text-purple-400 ' +
    'prose-code:before:content-none prose-code:after:content-none ' +
    'prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-medium prose-code:text-purple-700 prose-code:bg-purple-50 dark:prose-code:text-purple-300 dark:prose-code:bg-purple-900/30 ' +
    'prose-pre:bg-gray-50 prose-pre:text-gray-800 dark:prose-pre:bg-gray-950 dark:prose-pre:text-gray-200 ' +
    'prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700',
  invert:
    'prose prose-sm prose-invert max-w-none break-words ' +
    'prose-a:text-purple-300 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-medium prose-code:bg-white/10 prose-code:text-purple-200',
};

// One line of text: blocks become inline runs, so a card can clamp it.
const inline = ({ children }: { children?: React.ReactNode }) => <span>{children} </span>;
const COMPACT: Components = {
  h1: ({ children }) => <strong className="font-semibold text-gray-700 dark:text-gray-200">{children} </strong>,
  h2: ({ children }) => <strong className="font-semibold text-gray-700 dark:text-gray-200">{children} </strong>,
  h3: ({ children }) => <strong className="font-semibold text-gray-700 dark:text-gray-200">{children} </strong>,
  h4: inline,
  h5: inline,
  h6: inline,
  p: inline,
  ul: inline,
  ol: inline,
  li: ({ children }) => <span>· {children} </span>,
  blockquote: inline,
  table: () => null,
  pre: () => null,
  hr: () => null,
  img: () => null,
  br: () => <> </>,
  a: ({ children }) => <span className="text-purple-600 dark:text-purple-400">{children}</span>,
  strong: ({ children }) => <strong className="font-semibold text-gray-700 dark:text-gray-200">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1 font-mono text-[0.85em] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{children}</code>
  ),
};

interface MarkdownPreviewProps {
  children: string;
  /** `invert`: light text for dark surfaces such as the presentation. */
  tone?: Tone;
  /** One clamped paragraph for cards: no headings, tables or code blocks. */
  compact?: boolean;
  className?: string;
}

/** A diagram description rendered from Markdown (GFM: tables, task lists, strikethrough). */
export function MarkdownPreview({ children, tone = 'default', compact = false, className = '' }: MarkdownPreviewProps) {
  if (compact) {
    return (
      <div className={className}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPACT}>
          {children}
        </ReactMarkdown>
      </div>
    );
  }
  return (
    <div className={`${BLOCK_CLASSES[tone]} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
