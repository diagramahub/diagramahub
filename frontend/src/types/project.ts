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

// Configuration types for different diagram types
export type MermaidConfig = {
  theme?: string;
  layout?: string;
  look?: string;
  handDrawnSeed?: number | null;
  fontFamily?: string | null;
  fontSize?: number | null;
};

export type PlantUMLConfig = {
  theme?: string;
  skinparam?: Record<string, any>;
};

export type DiagramConfig = {
  mermaid?: MermaidConfig | null;
  plantuml?: PlantUMLConfig | null;
  background_color?: string;
  background_pattern?: string;
};

// Helper functions for creating diagram configurations
export const createMermaidConfig = (
  theme: string = "default",
  layout: string = "dagre",
  look: string = "classic",
  handDrawnSeed?: number | null,
  fontFamily?: string | null,
  fontSize?: number | null,
  background_color: string = "#ffffff",
  background_pattern: string = "plain"
): DiagramConfig => ({
  mermaid: {
    theme,
    layout,
    look,
    handDrawnSeed,
    fontFamily,
    fontSize,
  },
  background_color,
  background_pattern,
});

export const createPlantUMLConfig = (
  theme: string = "",
  skinparam: Record<string, any> = {},
  background_color: string = "#ffffff",
  background_pattern: string = "plain"
): DiagramConfig => ({
  plantuml: {
    theme,
    skinparam,
  },
  background_color,
  background_pattern,
});

// Helper to get mermaid config from a diagram
export const getMermaidConfig = (diagram: Diagram): MermaidConfig => {
  return diagram.config.mermaid || {};
};

export type Diagram = {
  id: string;
  title: string;
  content: string;
  description?: string;
  diagram_type: string;
  config: DiagramConfig;
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
  config?: DiagramConfig;
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
