interface PinIconProps {
  /** Filled when the panel is pinned, outlined otherwise. */
  pinned: boolean;
  className?: string;
}

/**
 * Pushpin icon shared by every pinnable editor panel (description, file explorer)
 * so pin toggles look and behave the same everywhere.
 */
export function PinIcon({ pinned, className = 'w-4 h-4' }: PinIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={pinned ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}
