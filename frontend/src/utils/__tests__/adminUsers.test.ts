import { describe, expect, it, vi } from 'vitest';

// locale.ts loads the i18n setup, which needs a browser; only its mapping matters here.
vi.mock('../locale', () => ({ dateLocale: (language: string) => (language.startsWith('en') ? 'en-US' : 'es-ES') }));

import { formatDate, formatMoney, initials, mfaMethodLabel } from '../adminUsers';

describe('admin user helpers', () => {
  it('takes initials from the first and last name, else from the email', () => {
    expect(initials('Ana María López', 'ana@example.com')).toBe('AL');
    expect(initials('ana', 'ana@example.com')).toBe('A');
    expect(initials(null, 'bob@example.com')).toBe('BO');
    expect(initials('   ', 'zoe@example.com')).toBe('ZO');
  });

  it('formats money in the currency, and falls back for an unknown code', () => {
    expect(formatMoney(15, 'USD', 'en')).toBe('$15.00');
    expect(formatMoney(3.5, 'NOPE1', 'en')).toBe('3.50 NOPE1');
  });

  it('uses the fallback for a missing date', () => {
    expect(formatDate(null, 'es')).toBe('—');
    expect(formatDate(undefined, 'en', 'Never')).toBe('Never');
    expect(formatDate('2026-11-18T10:00:00Z', 'en')).toMatch(/2026/);
  });

  it('labels MFA methods', () => {
    expect(mfaMethodLabel('email')).toBe('Email');
    expect(mfaMethodLabel('totp')).toBe('TOTP');
  });
});
