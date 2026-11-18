/** API keys (backend: api_tokens/schemas.py and permissions.py). */

export type ApiKeyArea = 'projects' | 'diagrams' | 'sharing' | 'community' | 'ai';
export type AccessLevel = 'none' | 'read' | 'write';
export type ApiKeyPermissions = Record<ApiKeyArea, AccessLevel>;

export interface ApiToken {
  id: string;
  name: string;
  token_hint: string;
  permissions: ApiKeyPermissions;
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
  permissions: Partial<ApiKeyPermissions>;
  /** 30, 90 or 365 days; null never expires. */
  expires_in_days: 30 | 90 | 365 | null;
}
