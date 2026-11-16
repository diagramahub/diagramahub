import { describe, expect, it } from 'vitest';
import type { CommunityComment } from '../../types/community';
import { compactCount, initials, parseTags, threadComments } from '../community';

const comment = (id: string, parent_id: string | null = null): CommunityComment => ({
  id,
  user_id: 'u',
  author_name: 'A',
  text: id,
  parent_id,
  is_publication_owner: false,
  can_delete: false,
  created_at: '2026-01-01T00:00:00',
});

describe('community helpers', () => {
  it('normalizes tags like the backend', () => {
    expect(parseTags('#Pagos, e commerce , pagos,,  K8S ')).toEqual(['pagos', 'e-commerce', 'k8s']);
  });

  it('builds initials', () => {
    expect(initials('Ana Autora')).toBe('AA');
    expect(initials('vic')).toBe('V');
    expect(initials('')).toBe('?');
  });

  it('threads replies under their parent and keeps orphans', () => {
    const threads = threadComments([comment('a'), comment('b'), comment('a1', 'a'), comment('x1', 'gone')]);
    expect(threads.map((t) => [t.comment.id, t.replies.map((r) => r.id)])).toEqual([
      ['a', ['a1']],
      ['b', []],
      ['x1', []],
    ]);
  });

  it('formats counts compactly', () => {
    expect(compactCount(950)).toBe('950');
    expect(compactCount(1500)).toBe('1.5k');
    expect(compactCount(12400)).toBe('12k');
  });
});
