export type Project = {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  user_id: string;
  diagram_count: number;
  diagram_type_counts?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export type DiagramConfig = {
  background_color?: string;
  background_pattern?: string;
};

export type DiagramUserPreferences = {
  description_pinned?: boolean;
  description_font_size?: number | null;
  description_panel_width?: number | null;
  chat_panel_width?: number | null;
  preferred_provider?: string | null;
  preferred_model?: string | null;
};

export type Diagram = {
  id: string;
  title: string;
  content: string;
  description?: string;
  diagram_type: string;
  config: DiagramConfig;
  user_preferences?: DiagramUserPreferences;
  project_id: string;
  folder_id?: string | null;
  viewport_zoom: number;
  viewport_x: number;
  viewport_y: number;
  created_at: string;
  updated_at: string;
}

export type Folder = {
  id: string;
  name: string;
  color: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export type FolderWithDiagrams = Folder & {
  diagrams: Diagram[];
}

export type ProjectWithDiagrams = Project & {
  diagrams: Diagram[];
  folders: FolderWithDiagrams[];
}

export type CreateProjectRequest = {
  name: string;
  description?: string;
  emoji?: string;
}

export type UpdateProjectRequest = {
  name?: string;
  description?: string;
  emoji?: string;
}

export type CreateDiagramRequest = {
  title: string;
  content?: string;
  description?: string;
  diagram_type?: string;
  folder_id?: string | null;
  config?: DiagramConfig;
}

export type UpdateDiagramRequest = {
  title?: string;
  content?: string;
  description?: string;
  diagram_type?: string;
  config?: DiagramConfig;
  user_preferences?: DiagramUserPreferences;
  folder_id?: string | null;
  viewport_zoom?: number;
  viewport_x?: number;
  viewport_y?: number;
}

export type CreateFolderRequest = {
  name: string;
  color?: string;
}

export type UpdateFolderRequest = {
  name?: string;
  color?: string;
}
