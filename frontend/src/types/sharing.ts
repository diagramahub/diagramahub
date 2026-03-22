/**
 * TypeScript types for the diagram sharing feature.
 * These interfaces match the backend Pydantic schemas in shared_links/schemas.py.
 */

/** Response model for shared link (owner view) - matches SharedLinkResponse */
export interface SharedLink {
  id: string;
  diagram_id: string;
  token: string;
  share_url: string;
  access_type: 'public' | 'protected';
  access_code?: string | null;
  allow_copy_code: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Public info response for a shared link - matches SharedLinkInfoResponse */
export interface SharedLinkInfo {
  requires_code: boolean;
  is_expired: boolean;
  diagram_title: string;
}

/** Response model for a shared diagram (visitor view) - matches SharedDiagramResponse */
export interface SharedDiagram {
  title: string;
  description: string | null;
  content: string | null;
  diagram_type: string;
  rendered_content: string;
  config: Record<string, unknown>;
  allow_copy_code: boolean;
}

/** Request model for creating a shared link - matches CreateSharedLinkRequest */
export interface CreateSharedLinkRequest {
  diagram_id: string;
  expiration_days: number | null;
  access_type: 'public' | 'protected';
  access_code?: string;
  allow_copy_code: boolean;
}

/** Request model for updating a shared link - matches UpdateSharedLinkRequest */
export interface UpdateSharedLinkRequest {
  expiration_days?: number | null;
  access_type?: 'public' | 'protected';
  access_code?: string;
  allow_copy_code?: boolean;
}

/** Request model for verifying an access code - matches VerifyAccessCodeRequest */
export interface VerifyAccessCodeRequest {
  access_code: string;
}
