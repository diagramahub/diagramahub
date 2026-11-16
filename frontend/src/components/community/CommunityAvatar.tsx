import { initials } from '../../utils/community';

/** Initials avatar for a community author (no photos or emails are exposed). */
export function CommunityAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const dims = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
  return (
    <span
      aria-hidden="true"
      className={`${dims} rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold flex-shrink-0`}
    >
      {initials(name)}
    </span>
  );
}
