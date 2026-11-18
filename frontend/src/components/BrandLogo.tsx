interface BrandLogoProps {
  /** sm: headers and footers · md: sidebar/navbar · lg: auth screens. */
  size?: 'sm' | 'md' | 'lg';
  /** Show only the mark (collapsed sidebar). */
  markOnly?: boolean;
  className?: string;
}

const MARK = {
  sm: 'w-5 h-5 text-[9px] rounded',
  md: 'w-6 h-6 text-[10px] rounded-md',
  lg: 'w-9 h-9 text-sm rounded-lg',
};

const WORDMARK = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-2xl',
};

/** DiagramaHub mark + wordmark, flat brand purple (no gradient). The product name is not translated. */
export function BrandLogo({ size = 'md', markOnly = false, className = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className={`${MARK[size]} inline-flex flex-shrink-0 items-center justify-center bg-purple-600 font-bold leading-none tracking-tight text-white`}
      >
        Dh
      </span>
      {!markOnly && (
        <span className={`${WORDMARK[size]} font-semibold tracking-tight text-gray-900 dark:text-white`}>DiagramaHub</span>
      )}
    </span>
  );
}
