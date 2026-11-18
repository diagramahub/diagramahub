import { describe, expect, it } from 'vitest';
import { exceedsPasswordMaxBytes, passwordByteLength, PASSWORD_MAX_BYTES } from '../passwordPolicy';

describe('passwordPolicy', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(passwordByteLength('abc')).toBe(3);
    expect(passwordByteLength('ñ')).toBe(2);
    expect(passwordByteLength('🙂')).toBe(4);
  });

  it('accepts a password of exactly the limit', () => {
    expect(exceedsPasswordMaxBytes('a'.repeat(PASSWORD_MAX_BYTES))).toBe(false);
  });

  it('rejects a password one byte over the limit', () => {
    expect(exceedsPasswordMaxBytes('a'.repeat(PASSWORD_MAX_BYTES + 1))).toBe(true);
  });

  it('rejects a short password made of multi-byte characters', () => {
    // 40 characters, 80 bytes
    expect(exceedsPasswordMaxBytes('ñ'.repeat(40))).toBe(true);
  });
});
