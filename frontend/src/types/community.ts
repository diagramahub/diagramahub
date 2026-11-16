/** Community portal (backend: community/schemas.py). */

export type CommunityCategory =
  | 'architecture'
  | 'databases'
  | 'business-processes'
  | 'devops'
  | 'uml'
  | 'security'
  | 'ai-data'
  | 'education';

export type CommunityLicense = 'cc-by-4.0' | 'cc0-1.0' | 'cc-by-sa-4.0' | 'all-rights-reserved';
export type CommunityTab = 'explore' | 'featured' | 'starred' | 'mine';
export type CommunitySort = 'trending' | 'stars' | 'forks' | 'recent';
export type PublishableType = 'mermaid' | 'plantuml' | 'd2' | 'dbml';

export interface PublicationCard {
  id: string;
  title: string;
  description: string;
  diagram_type: PublishableType;
  content: string;
  category: CommunityCategory;
  tags: string[];
  owner_id: string;
  owner_name: string;
  license: CommunityLicense;
  featured: boolean;
  hidden: boolean;
  stars_count: number;
  forks_count: number;
  comments_count: number;
  starred_by_me: boolean;
  published_at: string;
  updated_at: string;
}

export interface PublicationDetail extends PublicationCard {
  source_diagram_id: string | null;
  views_count: number;
  allow_forks: boolean;
  allow_comments: boolean;
  auto_update: boolean;
  is_owner: boolean;
  more_from_owner: { id: string; title: string; diagram_type: string }[];
}

export interface PublicationPage {
  items: PublicationCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface CommunityComment {
  id: string;
  user_id: string;
  author_name: string;
  text: string;
  parent_id: string | null;
  is_publication_owner: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface PublishRequest {
  diagram_id: string;
  category: CommunityCategory;
  tags: string[];
  description?: string;
  license: CommunityLicense;
  allow_forks: boolean;
  allow_comments: boolean;
  auto_update: boolean;
}

export type UpdatePublicationRequest = Partial<Omit<PublishRequest, 'diagram_id'>> & { refresh_content?: boolean };

export interface CommunityReport {
  id: string;
  target_type: 'diagram' | 'comment';
  target_id: string;
  publication_id: string;
  publication_title: string;
  reason: string;
  created_at: string;
}
