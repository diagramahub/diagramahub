export type Project = {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type Diagram = {
  id: string;
  title: string;
  content: string;
  description?: string;
  diagram_type: string;
  project_id: string;
  folder_id?: string | null;
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
}

export type UpdateProjectRequest = {
  name?: string;
  description?: string;
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
  folder_id?: string | null;
}

export type CreateFolderRequest = {
  name: string;
  color?: string;
}

export type UpdateFolderRequest = {
  name?: string;
  color?: string;
}
