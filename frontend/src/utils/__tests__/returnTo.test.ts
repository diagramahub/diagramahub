import { beforeEach, describe, expect, it } from 'vitest';
import { rememberReturnTo, safeReturnPath, takeReturnTo } from '../returnTo';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });
});

describe('returnTo', () => {
  it('accepts only same-app paths', () => {
    expect(safeReturnPath('/community/abc')).toBe('/community/abc');
    expect(safeReturnPath('//evil.com')).toBeNull();
    expect(safeReturnPath('/\\evil.com')).toBeNull();
    expect(safeReturnPath('https://evil.com')).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath('/\t/evil.com')).toBeNull();
    expect(safeReturnPath('/\n/evil.com')).toBeNull();
    expect(safeReturnPath('/ /evil.com')).toBeNull();
  });

  it('is read once', () => {
    rememberReturnTo('/community/abc?x=1');
    expect(takeReturnTo('/dashboard')).toBe('/community/abc?x=1');
    expect(takeReturnTo('/dashboard')).toBe('/dashboard');
  });

  it('ignores unsafe paths', () => {
    rememberReturnTo('//evil.com');
    expect(takeReturnTo('/dashboard')).toBe('/dashboard');
  });
});
