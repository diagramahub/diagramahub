import { describe, expect, it } from 'vitest';
import { OAUTH_AUTHORIZE_DOMAINS, STRIPE_DOMAINS, safeExternalUrl } from '../externalUrl';

describe('safeExternalUrl', () => {
  it('keeps https URLs on the expected hosts', () => {
    expect(safeExternalUrl('https://checkout.stripe.com/c/pay/cs_test_a1#frag', STRIPE_DOMAINS)).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_a1#frag',
    );
    expect(safeExternalUrl('https://billing.stripe.com/p/session/x', STRIPE_DOMAINS)).not.toBeNull();
    expect(safeExternalUrl('https://pay.stripe.com/invoice/acct_1/pdf', STRIPE_DOMAINS)).not.toBeNull();
    expect(
      safeExternalUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y', OAUTH_AUTHORIZE_DOMAINS),
    ).not.toBeNull();
  });

  it('rejects other hosts, look-alike hosts and non-https schemes', () => {
    for (const url of [
      undefined,
      null,
      '',
      'not a url',
      '/relative/path',
      '//checkout.stripe.com/x',
      'http://checkout.stripe.com/x',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://evil.com/?next=https://checkout.stripe.com',
      'https://stripe.com.evil.com/x',
      'https://evilstripe.com/x',
      'https://checkout.stripe.com@evil.com/x',
      'https://user:pass@checkout.stripe.com/x',
    ]) {
      expect(safeExternalUrl(url, STRIPE_DOMAINS)).toBeNull();
    }
  });

  it('does not let a provider list accept another provider', () => {
    expect(safeExternalUrl('https://checkout.stripe.com/x', OAUTH_AUTHORIZE_DOMAINS)).toBeNull();
    expect(safeExternalUrl('https://accounts.google.com.evil.com/x', OAUTH_AUTHORIZE_DOMAINS)).toBeNull();
  });
});
