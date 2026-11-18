import { describe, expect, it } from 'vitest';
import { formatStars, starsSpotlight } from '../repositoryStars';

describe('repository stars', () => {
  it('puts the count in the spotlight only once it says something', () => {
    expect([null, 0, 2, 49].map(starsSpotlight)).toEqual([false, false, false, false]);
    expect(starsSpotlight(50)).toBe(true);
  });

  it('formats exact counts and compacts big ones', () => {
    expect(formatStars(1234, 'en-US')).toBe('1,234');
    expect(formatStars(12_400, 'en-US')).toBe('12.4K');
  });
});
