/** Pure helpers for the community portal (no DOM; tested with Vitest). */
import type { CommunityCategory, CommunityComment } from '../types/community';

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  'architecture',
  'databases',
  'business-processes',
  'devops',
  'uml',
  'security',
  'ai-data',
  'education',
];

/** Everything published is public under this one license (backend: COMMUNITY_LICENSE). */
export const COMMUNITY_LICENSE = 'CC BY 4.0';

/** The license's human-readable summary, in Spanish or English. */
export function communityLicenseUrl(language: string): string {
  return `https://creativecommons.org/licenses/by/4.0/deed.${language.startsWith('es') ? 'es' : 'en'}`;
}

export const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;

/** Same normalization as the backend: lowercase, no '#', spaces become '-', unique. */
export function parseTags(input: string): string[] {
  const tags: string[] = [];
  for (const raw of input.split(',')) {
    const tag = raw.trim().toLowerCase().replace(/^#+/, '').split(/\s+/).filter(Boolean).join('-').slice(0, MAX_TAG_LENGTH);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** `current` plus the comma-separated tags in `input`, normalized, without repeats, at most `max`. */
export function addTags(current: string[], input: string, max = MAX_TAGS): string[] {
  const next = [...current];
  for (const tag of parseTags(input)) {
    if (next.length >= max) break;
    if (!next.includes(tag)) next.push(tag);
  }
  return next;
}

/** Initials for an avatar ("Ana Autora" -> "AA"). */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

export interface CommentThread {
  comment: CommunityComment;
  replies: CommunityComment[];
}

/** Group a flat, oldest-first comment list into top-level threads (replies under their parent). */
export function threadComments(comments: CommunityComment[]): CommentThread[] {
  const threads: CommentThread[] = [];
  const byId = new Map<string, CommentThread>();
  for (const comment of comments) {
    if (!comment.parent_id) {
      const thread = { comment, replies: [] };
      threads.push(thread);
      byId.set(comment.id, thread);
    }
  }
  for (const comment of comments) {
    if (!comment.parent_id) continue;
    const parent = byId.get(comment.parent_id);
    // A reply whose parent is gone (deleted account) is shown on its own.
    if (parent) parent.replies.push(comment);
    else threads.push({ comment, replies: [] });
  }
  return threads;
}

/** Compact counts: 950 -> "950", 1500 -> "1.5k". */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}
