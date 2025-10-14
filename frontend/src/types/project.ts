export type Project = {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  user_id: string;
  diagram_count: number;
  created_at: string;
  updated_at: string;
}

export type Diagram = {
  id: string;
  title: string;
  content: string;
  description?: string;
  diagram_type: string;
  theme?: string;
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
}

export type UpdateDiagramRequest = {
  title?: string;
  content?: string;
  description?: string;
  diagram_type?: string;
  theme?: string;
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
