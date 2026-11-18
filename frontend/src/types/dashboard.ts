/** Dashboard widgets (backend: activity, diagrams favorites, community impact). */

export interface ActivityDay {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Different diagrams worked on that day. */
  count: number;
}

export interface ActivityHeatmap {
  /** Oldest first, ending today in the user's time zone. */
  days: ActivityDay[];
  total: number;
  active_days: number;
  current_streak: number;
  longest_streak: number;
  timezone: string;
}

export interface DiagramListEntry {
  id: string;
  title: string;
  diagram_type: string;
  project_id: string;
  project_name: string;
  project_emoji: string;
  updated_at: string;
}

export interface FavoriteDiagrams {
  items: DiagramListEntry[];
  total: number;
}

export interface CommunityImpact {
  publications: number;
  stars: number;
  forks: number;
  views: number;
  comments: number;
  stars_last_30_days: number;
  top: {
    id: string;
    title: string;
    diagram_type: string;
    stars_count: number;
    forks_count: number;
    views_count: number;
  } | null;
}
