/** Formatting helpers of the admin user list and its detail panel. */
import { dateLocale } from './locale';

/** `18 nov 2026` (or the English equivalent) for a date coming from the API; `fallback` when empty. */
export function formatDate(value: string | null | undefined, language: string, fallback = '—'): string {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString(dateLocale(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMoney(amount: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(dateLocale(language), { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Up to two initials for the avatar: from the name, else from the email. */
export function initials(name: string | null, email: string): string {
  const source = (name || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export const DIAGRAM_TYPE_LABELS: Record<string, string> = {
  mermaid: 'Mermaid',
  plantuml: 'PlantUML',
  d2: 'D2',
  dbml: 'DBML',
};

export function mfaMethodLabel(method: string): string {
  return method === 'email' ? 'Email' : 'TOTP';
}
