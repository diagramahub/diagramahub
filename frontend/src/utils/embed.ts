/** Helpers for embedding shared diagrams in other sites. */

/** The framable view of a shared link: same token under /embed/. */
export function embedUrlFor(shareUrl: string): string {
  return shareUrl.replace(/\/shared\/(?=[^/]+$)/, '/embed/');
}

/** Ready-to-paste <iframe> snippet for a shared link; the title is HTML-escaped. */
export function iframeSnippet(shareUrl: string, title: string): string {
  const safeTitle = title.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<iframe src="${embedUrlFor(shareUrl)}" title="${safeTitle}" width="800" height="500" style="border:0" loading="lazy"></iframe>`;
}
