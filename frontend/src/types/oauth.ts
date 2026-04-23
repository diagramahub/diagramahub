/**
 * TypeScript types for OAuth/Social login integration
 */

export interface ActiveOAuthProvider {
  provider: string;
  authorization_url: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
  provider: string;
}

export interface OAuthCallbackResponse {
  access_token: string;
  token_type: string;
}

export interface OAuthAuthorizeResponse {
  authorization_url: string;
  state: string;
}
