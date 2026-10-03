/**
 * User-facing message for an AI request error. The backend may answer with a
 * plain string `detail` or with a code object (`{ error: "response_truncated" }`),
 * which React can't render: known codes are translated, anything else falls
 * back to the caller's message.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

export function aiErrorMessage(err: unknown, t: Translate, fallbackKey: string): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail;
  if (detail && typeof detail === 'object') {
    const code = (detail as { error?: string }).error;
    if (code === 'response_truncated') return t('ai.errors.truncated');
    if (code === 'empty_response') return t('ai.errors.empty');
    return t(fallbackKey);
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  return t(fallbackKey);
}
