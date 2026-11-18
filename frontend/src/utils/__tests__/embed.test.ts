import { describe, expect, it } from 'vitest';
import { embedUrlFor, iframeSnippet } from '../embed';

describe('embed', () => {
  it('points the shared link at the embed view', () => {
    expect(embedUrlFor('https://app.example.com/shared/AbC123')).toBe('https://app.example.com/embed/AbC123');
  });

  it('only rewrites the last path segment', () => {
    expect(embedUrlFor('https://shared.example.com/shared/tok')).toBe('https://shared.example.com/embed/tok');
    expect(embedUrlFor('https://x.example.com/app/shared/tok')).toBe('https://x.example.com/app/embed/tok');
  });

  it('builds an iframe with an escaped title', () => {
    const html = iframeSnippet('https://a.example/shared/t1', 'Login "flow" <v2> & more');
    expect(html).toContain('src="https://a.example/embed/t1"');
    expect(html).toContain('title="Login &#34;flow&#34; &#60;v2&#62; &#38; more"');
    expect(html).not.toContain('<v2>');
  });
});
