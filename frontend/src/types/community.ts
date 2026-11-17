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
  /** Always the community license (see COMMUNITY_LICENSE). */
  license: string;
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
  allow_comments: boolean;
  auto_update: boolean;
  is_owner: boolean;
  more_from_owner: { id: string; title: string; diagram_type: string }[];
  /** The publication this diagram was forked from; `publication_id` is null once it's gone. */
  forked_from: { publication_id: string | null; title: string; owner_name: string } | null;
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
