/** Personal API tokens (backend: api_tokens/schemas.py). */

export type ApiTokenScope = 'read' | 'write';

export interface ApiToken {
  id: string;
  name: string;
  token_hint: string;
  scope: ApiTokenScope;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

/** Returned once, right after creation: the only time `token` is available. */
export interface CreatedApiToken extends ApiToken {
  token: string;
}

export interface CreateApiTokenRequest {
  name: string;
  scope: ApiTokenScope;
  /** 30, 90 or 365 days; null never expires. */
  expires_in_days: 30 | 90 | 365 | null;
}
