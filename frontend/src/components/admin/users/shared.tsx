import { useState } from 'react';
import { initials } from '../../../utils/adminUsers';

export function UserAvatar({ name, email, size = 'md' }: { name: string | null; email: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-purple-50 font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 ${
        size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'
      }`}
    >
      {initials(name, email)}
    </span>
  );
}

type Tone = 'green' | 'red' | 'amber' | 'gray';

const TONES: Record<Tone, string> = {
  green: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/30',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  gray: 'bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
};

/** Small status pill (same shape as `.badge`, in a status color). */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const ShieldIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

export const ShieldOffIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
  </svg>
);

export const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export function AIProviderLogo({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const [imageError, setImageError] = useState(false);
  if (imageError) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full bg-gray-100 text-[9px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300`}
        aria-hidden="true"
      >
        {provider.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`/images/ai-providers/${provider}.svg`}
      alt=""
      className={`${className} object-contain`}
      loading="lazy"
      onError={() => setImageError(true)}
    />
  );
}
