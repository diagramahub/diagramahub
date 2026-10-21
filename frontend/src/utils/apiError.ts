import { isAxiosError } from 'axios';

/**
 * Raw `detail` of a FastAPI error response: a message, a structured payload
 * (e.g. `{ error: 'resource_limit_exceeded', ... }`) or a validation error list.
 */
export function apiErrorDetail(err: unknown): unknown {
  if (!isAxiosError(err)) return undefined;
  const data: unknown = err.response?.data;
  return typeof data === 'object' && data !== null && 'detail' in data
    ? (data as { detail?: unknown }).detail
    : undefined;
}

/**
 * Server error message to show the user, only when `detail` is a non-empty
 * string. Validation errors (a list of objects) return undefined so callers
 * fall back to their own translated message instead of rendering an object.
 */
export function apiErrorMessage(err: unknown): string | undefined {
  const detail = apiErrorDetail(err);
  return typeof detail === 'string' && detail ? detail : undefined;
}

/** `detail` payload of a plan limit error (HTTP 403 `resource_limit_exceeded`). */
export interface ResourceLimitDetail {
  error: 'resource_limit_exceeded';
  resource_type: string;
  current_usage: number;
  limit: number;
}

/** The plan limit payload when the request failed because of a plan limit. */
export function resourceLimitDetail(err: unknown): ResourceLimitDetail | undefined {
  const detail = apiErrorDetail(err);
  return typeof detail === 'object' && detail !== null &&
    (detail as { error?: unknown }).error === 'resource_limit_exceeded'
    ? (detail as ResourceLimitDetail)
    : undefined;
}

/** HTTP status of a failed API call, if the server answered. */
export function apiErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}
