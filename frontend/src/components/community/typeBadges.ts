/** Diagram type badges, same colors as the explorer (format identifiers, not copy). */
export const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  mermaid: { label: 'MMD', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  plantuml: { label: 'PUML', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  d2: { label: 'D2', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  dbml: { label: 'DBML', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};
