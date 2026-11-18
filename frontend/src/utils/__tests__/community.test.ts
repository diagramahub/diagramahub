import { describe, expect, it } from 'vitest';
import type { CommunityComment } from '../../types/community';
import { addTags, compactCount, initials, parseTags, threadComments, communityLicenseUrl } from '../community';

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

describe('communityLicenseUrl', () => {
  it('links the license summary in the reader\'s language', () => {
    expect(communityLicenseUrl('es-MX')).toBe('https://creativecommons.org/licenses/by/4.0/deed.es');
    expect(communityLicenseUrl('en')).toBe('https://creativecommons.org/licenses/by/4.0/deed.en');
  });
});

describe('addTags', () => {
  it('adds normalized lowercase tags without repeats', () => {
    expect(addTags(['pagos'], 'API Gateway, #Pagos, K8S')).toEqual(['pagos', 'api-gateway', 'k8s']);
    expect(addTags(['a'], '  ,  ')).toEqual(['a']);
  });

  it('stops at the limit', () => {
    expect(addTags(['a', 'b', 'c', 'd'], 'e, f, g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(addTags(['a', 'b'], 'c, d', 3)).toEqual(['a', 'b', 'c']);
  });
});
