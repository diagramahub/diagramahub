import { describe, expect, it } from 'vitest';
import { highlightParts } from '../highlight';

describe('highlightParts', () => {
  it('marks every case-insensitive occurrence', () => {
    expect(highlightParts('Pay then PAY again', 'pay')).toEqual([
      { text: 'Pay', match: true },
      { text: ' then ', match: false },
      { text: 'PAY', match: true },
      { text: ' again', match: false },
    ]);
  });

  it('treats the needle literally', () => {
    expect(highlightParts('a.*b and ab', '.*')).toEqual([
      { text: 'a', match: false },
      { text: '.*', match: true },
      { text: 'b and ab', match: false },
    ]);
  });

  it('returns the whole text when there is no needle or no match', () => {
    expect(highlightParts('graph TD', '')).toEqual([{ text: 'graph TD', match: false }]);
    expect(highlightParts('graph TD', 'zzz')).toEqual([{ text: 'graph TD', match: false }]);
  });
});
