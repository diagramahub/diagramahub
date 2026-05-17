import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  renderDiagram as renderDiagramUtil,
  isServerRenderedType,
} from "../utils/diagramRenderer";
import { escapeHtml } from "../utils/sanitize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../services/api";
import {
  Project,
  ProjectWithDiagrams,
  Diagram,
  CreateDiagramRequest,
  UpdateDiagramRequest,
} from "../types/project";
import { UserAISettings } from "../types/ai";
import DeleteFolderModal from "../components/DeleteFolderModal";
import ConfirmModal from "../components/ConfirmModal";
import Tooltip from "../components/Tooltip";
import AIChatPanel from "../components/AIChatPanel";
import NoAIProviderModal from "../components/NoAIProviderModal";
import UpgradePlanModal from "../components/UpgradePlanModal";
import MarkdownEditor from "../components/MarkdownEditor";
import { DiagramDiffView } from "../components/DiagramDiffView";
import ShareDiagramModal from "../components/ShareDiagramModal";
import DiagramCodePanel from "../components/DiagramCodePanel";
import DiagramFileBrowser from "../components/DiagramFileBrowser";
import { EditorSkeleton } from "../components/Skeleton";
import { useSetPresentationMode } from "../contexts/PresentationContext";
import { useTouchZoomPan } from "../hooks/useTouchZoomPan";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileBottomToolbar from "../components/MobileBottomToolbar";
import BottomSheet from "../components/BottomSheet";
import { useDiagramErrorDetection } from "../hooks/useDiagramErrorDetection";
import { FixDiagramResponse } from "../types/ai";
import { configInitBlockManager } from "../utils/configInitBlockManager";
import { plantUMLConfigManager } from "../utils/plantUMLConfigManager";
import { d2ConfigManager, D2_THEMES } from "../utils/d2ConfigManager";

export default function DiagramEditorPage() {
  const { projectId, diagramId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const [diagramCode, setDiagramCode] = useState(
    "graph TD\n  A[Start] --> B[End]",
  );
  const [diagramTitle, setDiagramTitle] = useState("New Diagram");
  const [diagramDescription, setDiagramDescription] = useState("");
  const [diagramTheme, setDiagramTheme] = useState("default");
  const [diagramLayout, setDiagramLayout] = useState("dagre");
  const [diagramLook, setDiagramLook] = useState("classic");
  const [diagramCurve, setDiagramCurve] = useState("basis");
  const [diagramFontFamily, setDiagramFontFamily] = useState("");
  const [diagramFontSize, setDiagramFontSize] = useState("16");
  const [plantUMLTheme, setPlantUMLTheme] = useState("");
  const [d2ThemeId, setD2ThemeId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"code" | "description">("code");

  // Background customization state
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundPattern, setBackgroundPattern] = useState("plain");

  // Helper function to generate background styles
  const getBackgroundStyle = (): React.CSSProperties => {
    if (backgroundPattern === "plain") {
      return { backgroundColor };
    }

    if (backgroundPattern === "dots") {
      return {
        backgroundColor,
        backgroundImage: `radial-gradient(circle, #00000015 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      };
    }

    if (backgroundPattern === "grid") {
      return {
        backgroundColor,
        backgroundImage: `
          linear-gradient(to right, #00000010 1px, transparent 1px),
          linear-gradient(to bottom, #00000010 1px, transparent 1px)
        `,
        backgroundSize: "20px 20px",
      };
    }

    return { backgroundColor };
  };

  // Helper function to generate frontmatter
  const generateFrontmatter = (
    theme: string,
    layout: string,
    look: string,
    curve: string,
    fontFamily: string,
    fontSize: string,
  ): string => {
    let config = `---\nconfig:\n  theme: ${theme}\n  layout: ${layout}\n  look: ${look}\n  flowchart:\n    curve: ${curve}`;

    // Add themeVariables if fontFamily or fontSize are set
    if (fontFamily || fontSize) {
      config += `\n  themeVariables:`;
      if (fontFamily) {
        config += `\n    fontFamily: "${fontFamily}"`;
      }
      if (fontSize) {
        config += `\n    fontSize: "${fontSize}px"`;
      }
    }

    config += `\n---\n`;
    return config;
  };

  // Helper function to format time ago
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return "";
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 10) return "justo ahora";
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  };

  // Generate full code with frontmatter for rendering
  const fullDiagramCode = useMemo(() => {
    if (currentDiagram?.diagram_type === "mermaid") {
      // Remove init block from diagram code before adding frontmatter for rendering
      const parseResult = configInitBlockManager.parseConfig(diagramCode);
      const codeWithoutInit = parseResult.contentWithoutInit;
      return (
        generateFrontmatter(
          diagramTheme,
          diagramLayout,
          diagramLook,
          diagramCurve,
          diagramFontFamily,
          diagramFontSize,
        ) + codeWithoutInit
      );
    } else if (currentDiagram?.diagram_type === "plantuml") {
      // For PlantUML, the theme is already embedded in the content
      // Just return the code as-is (theme directive is part of PlantUML syntax)
      return diagramCode;
    } else if (currentDiagram?.diagram_type === "d2") {
      // For D2, embed theme via vars block for rendering
      const parseResult = d2ConfigManager.parseTheme(diagramCode);
      const codeWithoutTheme = parseResult.contentWithoutTheme;
      return d2ConfigManager.embedTheme(codeWithoutTheme, {
        themeId: d2ThemeId,
      });
    }
    return diagramCode;
  }, [
    diagramCode,
    diagramTheme,
    diagramLayout,
    diagramLook,
    diagramCurve,
    diagramFontFamily,
    diagramFontSize,
    d2ThemeId,
    currentDiagram,
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Ref to track if we're updating from UI controls (to avoid infinite loops)
  const isUpdatingFromUI = useRef(false);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Touch gestures (pinch-to-zoom + single-finger pan)
  const touchHandlers = useTouchZoomPan({ zoom, pan, setZoom, setPan });

  // Export options state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeDescription: true,
    includeProjectInfo: true,
  });
  const [exporting, setExporting] = useState(false);

  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#3B82F6");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Drag & drop state
  const [draggedDiagramId, setDraggedDiagramId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null,
  );

  // New diagram modal state
  const [showNewDiagramModal, setShowNewDiagramModal] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState("");
  const [newDiagramFolderId, setNewDiagramFolderId] = useState<string | null>(
    null,
  );
  const [newDiagramType, setNewDiagramType] = useState<
    "mermaid" | "plantuml" | "d2" | "dbml"
  >("mermaid");
  const [creatingDiagram, setCreatingDiagram] = useState(false);
  const [isFirstDiagram, setIsFirstDiagram] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<{
    resourceType: string;
    currentUsage: number;
    limit: number;
  } | null>(null);

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  // Current time state (updates every second)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Collapsible panels state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync presentation mode to the layout context (hides sidebar)
  const setPresentationMode = useSetPresentationMode();
  useEffect(() => {
    setPresentationMode(isFullscreen);
  }, [isFullscreen, setPresentationMode]);

  // Mobile detection
  const isMobile = useIsMobile();

  // Floating panels state
  const [showFloatingSidebar, setShowFloatingSidebar] = useState(false);
  const [showCodeView, setShowCodeView] = useState(false);
  const [codePanelWidth, setCodePanelWidth] = useState(350);
  const isResizingCode = useRef(false);
  const [showDescriptionView, setShowDescriptionView] = useState(false);
  const [isDescriptionPinned, setIsDescriptionPinned] = useState(false);
  const [descriptionPanelWidth, setDescriptionPanelWidth] = useState(384);
  const [descriptionFontSize, setDescriptionFontSize] = useState(14);
  const isResizingDescription = useRef(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(400);
  const isResizingChat = useRef(false);
  const [preferredProvider, setPreferredProvider] = useState<string | null>(
    null,
  );
  const [preferredModel, setPreferredModel] = useState<string | null>(null);
  const [showAppearanceEditor, setShowAppearanceEditor] = useState(false);

  // Project selector state
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const projectSelectorRef = useRef<HTMLDivElement>(null);

  // AI generation state
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [showDescriptionConfirmModal, setShowDescriptionConfirmModal] =
    useState(false);
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [aiSettings, setAiSettings] = useState<UserAISettings | null>(null);
  const [showNoAIModal, setShowNoAIModal] = useState(false);

  // Copy code state
  const [codeCopied, setCodeCopied] = useState(false);

  // Fix diagram state
  const [showFixDiffModal, setShowFixDiffModal] = useState(false);
  const [fixResult, setFixResult] = useState<FixDiagramResponse | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);

  // Share diagram state
  const [showShareModal, setShowShareModal] = useState(false);
  const [isShared, setIsShared] = useState(false);

  // Use error detection hook
  const diagramError = useDiagramErrorDetection(
    diagramCode,
    currentDiagram?.diagram_type || "mermaid",
  );

  // Render error state (from Kroki)
  const [renderError, setRenderError] = useState<string | null>(null);

  // Debug: Log error state
  useEffect(() => {
    console.log("🔍 Diagram Error State:", diagramError);
  }, [diagramError]);

  // Load AI Settings
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const settings = await api.getAISettings();
        setAiSettings(settings);
      } catch (err) {
        console.error("Error loading AI settings:", err);
      }
    };
    loadAISettings();
  }, []);

  const validateAIConfiguration = () => {
    if (
      !aiSettings ||
      !aiSettings.providers ||
      aiSettings.providers.length === 0
    ) {
      setShowNoAIModal(true);
      return false;
    }
    return true;
  };

  // Check shared status when diagram loads
  const checkSharedStatus = async (id: string) => {
    try {
      const link = await api.getSharedLinkByDiagram(id);
      // Check if link is active and not expired
      const isActive = link.is_active;
      const isNotExpired =
        !link.expires_at || new Date(link.expires_at) > new Date();
      setIsShared(isActive && isNotExpired);
    } catch {
      setIsShared(false);
    }
  };

  useEffect(() => {
    if (diagramId) {
      checkSharedStatus(diagramId);
    } else {
      setIsShared(false);
    }
  }, [diagramId]);

  // Inline editing state
  const [isEditingDiagramTitle, setIsEditingDiagramTitle] = useState(false);
  const [editingDiagramTitle, setEditingDiagramTitle] = useState("");

  // Close floating panels when clicking outside (desktop only — mobile uses BottomSheets)
  useEffect(() => {
    if (isMobile) return; // BottomSheets handle their own dismissal via backdrop & swipe

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Only close floating sidebar on click outside
      if (
        !target.closest(".floating-sidebar") &&
        !target.closest(".floating-sidebar-button")
      ) {
        setShowFloatingSidebar(false);
      }
      // Only close appearance editor on click outside
      if (
        !target.closest(".floating-appearance") &&
        !target.closest(".floating-appearance-button")
      ) {
        setShowAppearanceEditor(false);
      }
      // Description panel: only close on click outside if not pinned
      // BUT don't close if clicking on any toolbar button (code toggle, appearance, etc.)
      if (
        !target.closest(".floating-description") &&
        !target.closest(".floating-description-button") &&
        !target.closest(".floating-description-resize-handle") &&
        !target.closest(".floating-code-button") &&
        !target.closest(".floating-appearance-button") &&
        !target.closest(".floating-sidebar-button")
      ) {
        if (!isDescriptionPinned) {
          setShowDescriptionView(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDescriptionPinned, isMobile]);

  // Close project selector when clicking outside
  useEffect(() => {
    const handleClickOutsideProjectSelector = (event: MouseEvent) => {
      if (
        projectSelectorRef.current &&
        !projectSelectorRef.current.contains(event.target as Node)
      ) {
        setShowProjectSelector(false);
        setProjectSearchQuery("");
      }
    };

    const handleEscapeProjectSelector = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowProjectSelector(false);
        setProjectSearchQuery("");
      }
    };

    if (showProjectSelector) {
      document.addEventListener("mousedown", handleClickOutsideProjectSelector);
      document.addEventListener("keydown", handleEscapeProjectSelector);
    }
    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutsideProjectSelector,
      );
      document.removeEventListener("keydown", handleEscapeProjectSelector);
    };
  }, [showProjectSelector]);

  // Fetch all projects when selector opens
  const handleOpenProjectSelector = async () => {
    setShowProjectSelector((prev) => !prev);
    if (!showProjectSelector && allProjects.length === 0) {
      setLoadingProjects(true);
      try {
        const projects = await api.getProjects();
        setAllProjects(projects);
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoadingProjects(false);
      }
    }
  };

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return allProjects;
    const query = projectSearchQuery.toLowerCase();
    return allProjects.filter((p) => p.name.toLowerCase().includes(query));
  }, [allProjects, projectSearchQuery]);

  // Handle project selection from dropdown
  const handleSelectProject = (selectedProjectId: string) => {
    setShowProjectSelector(false);
    setProjectSearchQuery("");
    if (selectedProjectId !== projectId) {
      navigate(`/projects/${selectedProjectId}`);
    }
  };

  // Diagram search state for floating sidebar
  const [diagramSearchQuery, setDiagramSearchQuery] = useState("");

  // Filter diagrams and folders based on search query for floating sidebar
  const filteredSidebarData = useMemo(() => {
    if (!project) return { diagrams: [], folders: [] };
    const query = diagramSearchQuery.toLowerCase().trim();
    if (!query) return { diagrams: project.diagrams, folders: project.folders };

    const filteredDiagrams = project.diagrams.filter((d) =>
      d.title.toLowerCase().includes(query),
    );
    const filteredFolders = project.folders
      .map((folder) => ({
        ...folder,
        diagrams: folder.diagrams.filter((d) =>
          d.title.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (folder) =>
          folder.name.toLowerCase().includes(query) ||
          folder.diagrams.length > 0,
      );

    return { diagrams: filteredDiagrams, folders: filteredFolders };
  }, [project, diagramSearchQuery]);

  // Code panel resize handler
  const handleCodeResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingCode.current = true;
      const startX = e.clientX;
      const startWidth = codePanelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizingCode.current) return;
        const delta = e.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + delta, 200), 800);
        setCodePanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizingCode.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [codePanelWidth],
  );

  // Description panel resize handler
  const handleDescriptionResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingDescription.current = true;
      const startX = e.clientX;
      const startWidth = descriptionPanelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizingDescription.current) return;
        const delta = startX - e.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, 280), 700);
        setDescriptionPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizingDescription.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [descriptionPanelWidth],
  );

  const handleChatResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingChat.current = true;
      const startX = e.clientX;
      const startWidth = chatPanelWidth;

      const handleMouseMove = (event: MouseEvent) => {
        if (!isResizingChat.current) return;
        const delta = startX - event.clientX;
        const newWidth = Math.min(Math.max(startWidth + delta, 320), 700);
        setChatPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizingChat.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [chatPanelWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !diagramId) return;
    const savedWidth = window.localStorage.getItem(
      `chatPanelWidth_${diagramId}`,
    );
    if (savedWidth) {
      const parsed = Number(savedWidth);
      if (!Number.isNaN(parsed)) {
        setChatPanelWidth(Math.min(Math.max(parsed, 320), 700));
      }
    }
  }, [diagramId]);

  useEffect(() => {
    if (typeof window === "undefined" || !diagramId) return;
    window.localStorage.setItem(
      `chatPanelWidth_${diagramId}`,
      String(chatPanelWidth),
    );
  }, [diagramId, chatPanelWidth]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Update time ago display every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update time display
      if (lastSavedTime) {
        setLastSavedTime(new Date(lastSavedTime));
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSavedTime]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isFullscreen]);

  // Delete confirmation modal state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [deleteFolderModal, setDeleteFolderModal] = useState<{
    isOpen: boolean;
    folderId: string | null;
    folderName: string;
    diagramCount: number;
  }>({
    isOpen: false,
    folderId: null,
    folderName: "",
    diagramCount: 0,
  });

  const [deleteDiagramModal, setDeleteDiagramModal] = useState<{
    isOpen: boolean;
    diagramId: string | null;
    diagramName: string;
  }>({
    isOpen: false,
    diagramId: null,
    diagramName: "",
  });

  // Helper functions for localStorage
  const getLastViewedDiagram = (projectId: string): string | null => {
    try {
      return localStorage.getItem(`lastDiagram_${projectId}`);
    } catch {
      return null;
    }
  };

  const saveLastViewedDiagram = (projectId: string, diagramId: string) => {
    try {
      localStorage.setItem(`lastDiagram_${projectId}`, diagramId);
    } catch (err) {
      console.warn("Failed to save last viewed diagram:", err);
    }
  };

  // Mermaid initialization is handled by the renderDiagram utility

  // Load project and diagram
  useEffect(() => {
    initialLoadComplete.current = false;
    loadProject();
  }, [projectId, diagramId]);

  // Save last viewed diagram when diagramId changes
  useEffect(() => {
    if (projectId && diagramId) {
      saveLastViewedDiagram(projectId, diagramId);
    }
  }, [projectId, diagramId]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const projectData = await api.getProject(projectId);
      setProject(projectData);

      if (diagramId) {
        // Load existing diagram - check in root diagrams
        let diagram = projectData.diagrams.find((d) => d.id === diagramId);
        let diagramFolderId = null;

        // If not found in root, check in folders
        if (!diagram) {
          for (const folder of projectData.folders) {
            diagram = folder.diagrams.find((d) => d.id === diagramId);
            if (diagram) {
              diagramFolderId = folder.id;
              break;
            }
          }
        }

        if (diagram) {
          setCurrentDiagram(diagram);

          // For Mermaid diagrams, keep the full content with init block
          // The init block will be parsed for UI controls but kept in the code editor
          if (diagram.diagram_type === "mermaid") {
            const parseResult = configInitBlockManager.parseConfig(
              diagram.content,
            );

            if (parseResult.config) {
              // Use parsed config from content to populate UI controls
              setDiagramTheme(parseResult.config.theme);
              setDiagramLayout(parseResult.config.layout);
              setDiagramLook(parseResult.config.look);
              setDiagramFontFamily(parseResult.config.fontFamily || "");
              setDiagramFontSize(
                parseResult.config.fontSize?.toString() || "16",
              );
              setDiagramCurve(parseResult.config.curve || "basis");
            } else {
              // Fallback to default values if no init block found
              setDiagramTheme("default");
              setDiagramLayout("dagre");
              setDiagramLook("classic");
              setDiagramFontFamily("");
              setDiagramFontSize("16");
              setDiagramCurve("basis");
            }

            // Keep the full content (with init block if present)
            setDiagramCode(diagram.content);
          } else if (diagram.diagram_type === "plantuml") {
            // For PlantUML diagrams, parse theme from content
            const parseResult = plantUMLConfigManager.parseTheme(
              diagram.content,
            );

            if (parseResult.config?.theme) {
              // Use parsed theme from content to populate UI controls
              setPlantUMLTheme(parseResult.config.theme);
            } else {
              // Fallback to default value if no theme directive found
              setPlantUMLTheme("");
            }

            // Keep the full content (with theme directive if present)
            setDiagramCode(diagram.content);
          } else {
            // For D2 and other server-rendered types, parse theme if D2
            if (diagram.diagram_type === "d2") {
              const parseResult = d2ConfigManager.parseTheme(diagram.content);
              if (parseResult.config?.themeId !== undefined) {
                setD2ThemeId(parseResult.config.themeId);
              } else {
                setD2ThemeId(0);
              }
            }
            setDiagramCode(diagram.content);
          }

          setDiagramDescription(diagram.description || "");
          setDiagramTitle(diagram.title);

          // Load background config (always from config object, never from init/theme block)
          setBackgroundColor(diagram.config.background_color || "#ffffff");
          setBackgroundPattern(diagram.config.background_pattern || "plain");

          setSelectedFolderId(diagram.folder_id || null);
          // Restore viewport position
          setZoom(diagram.viewport_zoom || 1);
          setPan({ x: diagram.viewport_x || 0, y: diagram.viewport_y || 0 });

          // Restore user preferences
          if (diagram.user_preferences) {
            if (diagram.user_preferences.description_pinned) {
              setIsDescriptionPinned(true);
              setShowDescriptionView(true);
            }
            if (diagram.user_preferences.description_font_size) {
              setDescriptionFontSize(
                diagram.user_preferences.description_font_size,
              );
            }
            if (diagram.user_preferences.description_panel_width) {
              setDescriptionPanelWidth(
                diagram.user_preferences.description_panel_width,
              );
            }
            if (diagram.user_preferences.chat_panel_width) {
              setChatPanelWidth(diagram.user_preferences.chat_panel_width);
            }
            if (diagram.user_preferences.preferred_provider) {
              setPreferredProvider(diagram.user_preferences.preferred_provider);
            }
            if (diagram.user_preferences.preferred_model) {
              setPreferredModel(diagram.user_preferences.preferred_model);
            }
          }

          // If diagram is inside a folder, expand that folder
          if (diagramFolderId) {
            setExpandedFolders((prev) => {
              const newSet = new Set(prev);
              newSet.add(diagramFolderId);
              return newSet;
            });
          }
        } else {
          setError("Diagram not found");
        }
      } else {
        // No diagramId in URL - try to load last viewed diagram or first available
        let targetDiagram = null;

        // Try to get last viewed diagram from localStorage
        const lastViewedId = getLastViewedDiagram(projectId);
        if (lastViewedId) {
          // Try to find the last viewed diagram in root diagrams
          targetDiagram = projectData.diagrams.find(
            (d) => d.id === lastViewedId,
          );

          // If not found in root, check in folders
          if (!targetDiagram) {
            for (const folder of projectData.folders) {
              targetDiagram = folder.diagrams.find(
                (d) => d.id === lastViewedId,
              );
              if (targetDiagram) break;
            }
          }
        }

        // If no last viewed diagram or it doesn't exist anymore, get first available
        if (!targetDiagram) {
          // First, try to find a diagram outside of folders (root diagrams)
          if (projectData.diagrams.length > 0) {
            targetDiagram = projectData.diagrams[0];
          } else {
            // If no root diagrams, find first diagram in first folder
            for (const folder of projectData.folders) {
              if (folder.diagrams.length > 0) {
                targetDiagram = folder.diagrams[0];
                break;
              }
            }
          }
        }

        if (targetDiagram) {
          // Navigate to the target diagram
          navigate(`/projects/${projectId}/diagrams/${targetDiagram.id}`, {
            replace: true,
          });
        } else {
          // No diagrams at all - show modal to create first diagram
          setIsFirstDiagram(true);
          setShowNewDiagramModal(true);
        }
      }
    } catch (err) {
      setError("Error loading project");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Render diagram (Mermaid or PlantUML)
  useEffect(() => {
    const doRender = async () => {
      if (!mermaidRef.current) return;

      try {
        mermaidRef.current.innerHTML = "";

        // Detect diagram type
        const diagramType = currentDiagram?.diagram_type || "mermaid";

        // Validate code is not empty
        if (!diagramCode.trim()) {
          const label = isServerRenderedType(diagramType)
            ? diagramType.toUpperCase()
            : "Mermaid";
          mermaidRef.current.innerHTML = `<div class="text-gray-400 p-4 text-center">Escribe código ${label} para ver el diagrama...</div>`;
          return;
        }

        // Use centralized rendering utility
        const result = await renderDiagramUtil(fullDiagramCode, diagramType);

        if (!mermaidRef.current) return;

        if ("svg" in result) {
          mermaidRef.current.innerHTML = result.svg;
          setRenderError(null);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        if (!mermaidRef.current) return;
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setRenderError(errorMessage);

        // Only show error if it's not just "Syntax error in text" (which is too generic)
        if (errorMessage.includes("Syntax error in text")) {
          mermaidRef.current.innerHTML = `<div class="text-amber-600 dark:text-amber-400 p-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p class="font-semibold mb-2">⚠️ Error de sintaxis en el diagrama</p>
            <p class="text-sm">Verifica que:</p>
            <ul class="text-sm list-disc ml-5 mt-2">
              <li>El tipo de diagrama sea válido (graph, flowchart, sequenceDiagram, etc.)</li>
              <li>La sintaxis de las flechas y nodos sea correcta</li>
              <li>No haya caracteres especiales sin escapar</li>
              <li>Las comillas estén balanceadas</li>
            </ul>
          </div>`;
        } else {
          mermaidRef.current.innerHTML = `<div class="text-red-500 dark:text-red-400 p-4 border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p class="font-semibold mb-2">❌ Error al renderizar diagrama</p>
            <p class="text-sm">${escapeHtml(errorMessage)}</p>
          </div>`;
        }
      }
    };

    // Render immediately on first load, then with debounce for subsequent changes
    if (currentDiagram) {
      // If diagram just loaded, render immediately
      doRender();
    } else {
      // For new diagrams or while editing, use debounce
      const debounce = setTimeout(doRender, 500); // Increased debounce time
      return () => clearTimeout(debounce);
    }
  }, [fullDiagramCode, currentDiagram, diagramCode]);

  // Autosave effect for diagram content
  useEffect(() => {
    if (!currentDiagram || !projectId) return;

    const autoSave = async () => {
      try {
        setSaveStatus("saving");

        // Prepare content with embedded config
        let contentToSave = diagramCode;

        if (currentDiagram?.diagram_type === "mermaid") {
          // Check if code already has an init block
          const parseResult = configInitBlockManager.parseConfig(diagramCode);

          // If there's already an init block, keep the code as-is
          // Otherwise, embed the config from UI controls
          if (!parseResult.config) {
            // No init block found, embed config from UI controls
            const codeWithoutInit = parseResult.contentWithoutInit;
            contentToSave = configInitBlockManager.embedConfig(
              codeWithoutInit,
              {
                theme: diagramTheme,
                layout: diagramLayout,
                look: diagramLook,
                handDrawnSeed:
                  diagramLook === "handDrawn"
                    ? Math.floor(Math.random() * 1000)
                    : undefined,
                fontFamily: diagramFontFamily || undefined,
                fontSize: diagramFontSize
                  ? parseInt(diagramFontSize)
                  : undefined,
                curve: diagramCurve || undefined,
              },
            );
          }
          // If init block exists, use the code as-is (user may have edited it manually)
        } else if (currentDiagram?.diagram_type === "plantuml") {
          // Check if code already has a theme directive
          const parseResult = plantUMLConfigManager.parseTheme(diagramCode);

          // If there's already a theme directive, keep the code as-is
          // Otherwise, embed the theme from UI controls
          if (!parseResult.config) {
            // No theme directive found, embed theme from UI controls
            const codeWithoutTheme = parseResult.contentWithoutTheme;
            contentToSave = plantUMLConfigManager.embedTheme(codeWithoutTheme, {
              theme: plantUMLTheme || undefined,
            });
          }
          // If theme directive exists, use the code as-is (user may have edited it manually)
        } else if (currentDiagram?.diagram_type === "d2") {
          // For D2, embed theme via vars block
          const parseResult = d2ConfigManager.parseTheme(diagramCode);
          if (!parseResult.config) {
            // No theme block found, embed theme from UI controls
            const codeWithoutTheme = parseResult.contentWithoutTheme;
            contentToSave = d2ConfigManager.embedTheme(codeWithoutTheme, {
              themeId: d2ThemeId || undefined,
            });
          }
          // If vars block exists, use the code as-is (user may have edited it manually)
        }

        const updateData: UpdateDiagramRequest = {
          title: diagramTitle,
          content: contentToSave,
          description: diagramDescription,
          config: {
            background_color: backgroundColor,
            background_pattern: backgroundPattern,
          },
          user_preferences: {
            description_pinned: isDescriptionPinned,
            description_font_size: descriptionFontSize,
            description_panel_width: descriptionPanelWidth,
            chat_panel_width: chatPanelWidth,
            preferred_provider: preferredProvider,
            preferred_model: preferredModel,
          },
          folder_id: selectedFolderId,
          viewport_zoom: zoom,
          viewport_x: pan.x,
          viewport_y: pan.y,
        };
        await api.updateDiagram(currentDiagram.id, updateData);
        setSaveStatus("saved");
        setLastSavedTime(new Date());

        // Update the project state to reflect the new title in the sidebar
        if (project) {
          const updatedProject = { ...project };

          // Update in root diagrams
          const rootDiagramIndex = updatedProject.diagrams.findIndex(
            (d) => d.id === currentDiagram.id,
          );
          if (rootDiagramIndex !== -1) {
            updatedProject.diagrams[rootDiagramIndex] = {
              ...updatedProject.diagrams[rootDiagramIndex],
              title: diagramTitle,
              content: contentToSave,
              description: diagramDescription,
              folder_id: selectedFolderId,
            };
          } else {
            // Update in folder diagrams
            for (const folder of updatedProject.folders) {
              const folderDiagramIndex = folder.diagrams.findIndex(
                (d) => d.id === currentDiagram.id,
              );
              if (folderDiagramIndex !== -1) {
                folder.diagrams[folderDiagramIndex] = {
                  ...folder.diagrams[folderDiagramIndex],
                  title: diagramTitle,
                  content: contentToSave,
                  description: diagramDescription,
                  folder_id: selectedFolderId,
                };
                break;
              }
            }
          }

          setProject(updatedProject);
        }

        // Hide "Guardado" after 2 seconds
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (err) {
        console.error("Error autosaving:", err);
        setSaveStatus("idle");
      }
    };

    const debounce = setTimeout(autoSave, 1500);
    return () => clearTimeout(debounce);
  }, [
    diagramCode,
    diagramDescription,
    diagramTitle,
    diagramTheme,
    diagramLayout,
    diagramLook,
    diagramCurve,
    diagramFontFamily,
    diagramFontSize,
    plantUMLTheme,
    d2ThemeId,
    backgroundColor,
    backgroundPattern,
    selectedFolderId,
    isDescriptionPinned,
    descriptionFontSize,
    descriptionPanelWidth,
    chatPanelWidth,
    preferredProvider,
    preferredModel,
  ]);

  // Parse config from content when user manually edits Mermaid code with init block
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "mermaid") return;

    // Skip if we're updating from UI controls
    if (isUpdatingFromUI.current) {
      isUpdatingFromUI.current = false;
      return;
    }

    // Parse config from diagram code
    const parseResult = configInitBlockManager.parseConfig(diagramCode);

    if (parseResult.config) {
      // Only update if values are different to avoid infinite loops
      if (parseResult.config.theme !== diagramTheme) {
        setDiagramTheme(parseResult.config.theme);
      }
      if (parseResult.config.layout !== diagramLayout) {
        setDiagramLayout(parseResult.config.layout);
      }
      if (parseResult.config.look !== diagramLook) {
        setDiagramLook(parseResult.config.look);
      }
      if (
        parseResult.config.fontFamily &&
        parseResult.config.fontFamily !== diagramFontFamily
      ) {
        setDiagramFontFamily(parseResult.config.fontFamily);
      }
      if (
        parseResult.config.fontSize &&
        parseResult.config.fontSize.toString() !== diagramFontSize
      ) {
        setDiagramFontSize(parseResult.config.fontSize.toString());
      }
      if (
        parseResult.config.curve &&
        parseResult.config.curve !== diagramCurve
      ) {
        setDiagramCurve(parseResult.config.curve);
      }
    }
  }, [diagramCode]);

  // Parse theme from content when user manually edits PlantUML code with theme directive
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "plantuml") return;

    // Skip if we're updating from UI controls
    if (isUpdatingFromUI.current) {
      isUpdatingFromUI.current = false;
      return;
    }

    // Parse theme from diagram code
    const parseResult = plantUMLConfigManager.parseTheme(diagramCode);

    if (parseResult.config?.theme) {
      // Only update if value is different to avoid infinite loops
      if (parseResult.config.theme !== plantUMLTheme) {
        setPlantUMLTheme(parseResult.config.theme);
      }
    }
  }, [diagramCode]);

  // Parse theme from content when user manually edits D2 code with vars block
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "d2") return;

    // Skip if we're updating from UI controls
    if (isUpdatingFromUI.current) {
      isUpdatingFromUI.current = false;
      return;
    }

    // Parse theme from diagram code
    const parseResult = d2ConfigManager.parseTheme(diagramCode);

    if (parseResult.config?.themeId !== undefined) {
      if (parseResult.config.themeId !== d2ThemeId) {
        setD2ThemeId(parseResult.config.themeId);
      }
    }
  }, [diagramCode]);

  // Update init block in code when UI controls change (for Mermaid diagrams)
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "mermaid") return;

    // Parse current code to get content without init block
    const parseResult = configInitBlockManager.parseConfig(diagramCode);
    const codeWithoutInit = parseResult.contentWithoutInit;

    // Create new config from UI controls
    const newConfig = {
      theme: diagramTheme,
      layout: diagramLayout,
      look: diagramLook,
      handDrawnSeed:
        diagramLook === "handDrawn"
          ? Math.floor(Math.random() * 1000)
          : undefined,
      fontFamily: diagramFontFamily || undefined,
      fontSize: diagramFontSize ? parseInt(diagramFontSize) : undefined,
      curve: diagramCurve || undefined,
    };

    // Embed new config in code
    const updatedCode = configInitBlockManager.embedConfig(
      codeWithoutInit,
      newConfig,
    );

    // Only update if the code actually changed
    if (updatedCode !== diagramCode) {
      isUpdatingFromUI.current = true;
      setDiagramCode(updatedCode);
    }
  }, [
    diagramTheme,
    diagramLayout,
    diagramLook,
    diagramFontFamily,
    diagramFontSize,
    diagramCurve,
    currentDiagram,
  ]);

  // Update theme directive in code when UI controls change (for PlantUML diagrams)
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "plantuml") return;

    // Parse current code to get content without theme directive
    const parseResult = plantUMLConfigManager.parseTheme(diagramCode);
    const codeWithoutTheme = parseResult.contentWithoutTheme;

    // Create new config from UI controls
    const newConfig = {
      theme: plantUMLTheme || undefined,
    };

    // Embed new theme in code
    const updatedCode = plantUMLConfigManager.embedTheme(
      codeWithoutTheme,
      newConfig,
    );

    // Only update if the code actually changed
    if (updatedCode !== diagramCode) {
      isUpdatingFromUI.current = true;
      setDiagramCode(updatedCode);
    }
  }, [plantUMLTheme, currentDiagram]);

  // Update vars block in code when UI controls change (for D2 diagrams)
  useEffect(() => {
    if (!currentDiagram || currentDiagram.diagram_type !== "d2") return;

    // Parse current code to get content without theme block
    const parseResult = d2ConfigManager.parseTheme(diagramCode);
    const codeWithoutTheme = parseResult.contentWithoutTheme;

    // Embed new theme in code
    const updatedCode = d2ConfigManager.embedTheme(codeWithoutTheme, {
      themeId: d2ThemeId || undefined,
    });

    // Only update if the code actually changed
    if (updatedCode !== diagramCode) {
      isUpdatingFromUI.current = true;
      setDiagramCode(updatedCode);
    }
  }, [d2ThemeId, currentDiagram]);

  // Separate effect for viewport changes (zoom/pan) - saves less frequently
  useEffect(() => {
    if (!currentDiagram || !projectId) return;

    const saveViewport = async () => {
      try {
        setSaveStatus("saving");
        await api.updateDiagram(currentDiagram.id, {
          viewport_zoom: zoom,
          viewport_x: pan.x,
          viewport_y: pan.y,
        });
        setSaveStatus("saved");
        setLastSavedTime(new Date());
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Error saving viewport:", err);
        setSaveStatus("idle");
      }
    };

    // Longer debounce for viewport changes (only save after user stops moving for 1 second)
    const debounce = setTimeout(saveViewport, 1000);
    return () => clearTimeout(debounce);
  }, [zoom, pan]);

  const handleNewDiagram = (folderId: string | null = null) => {
    setNewDiagramName("");
    setNewDiagramFolderId(folderId);
    setIsFirstDiagram(false); // Always false when manually creating a diagram
    setShowNewDiagramModal(true);
  };

  const handleCreateDiagram = async () => {
    if (!projectId || !newDiagramName.trim()) return;

    try {
      setCreatingDiagram(true);

      // Define default content based on diagram type
      let defaultContent: string;
      if (newDiagramType === "mermaid") {
        defaultContent = "graph TD\n  A[Start] --> B[End]";
      } else if (newDiagramType === "d2") {
        defaultContent = "x -> y: hello world";
      } else if (newDiagramType === "dbml") {
        defaultContent =
          "Table users {\n  id integer [primary key]\n  username varchar\n  email varchar\n  created_at timestamp\n}\n\nTable posts {\n  id integer [primary key]\n  title varchar\n  body text\n  user_id integer\n  created_at timestamp\n}\n\nRef: posts.user_id > users.id";
      } else {
        defaultContent =
          "@startuml\nAlice -> Bob: Hello\nBob -> Alice: Hi!\n@enduml";
      }

      const createData: CreateDiagramRequest = {
        title: newDiagramName,
        content: defaultContent,
        description: "",
        diagram_type: newDiagramType,
        folder_id: newDiagramFolderId,
        // Set default background pattern to grid for Mermaid diagrams
        config:
          newDiagramType === "mermaid"
            ? {
                background_color: "#ffffff",
                background_pattern: "grid",
              }
            : undefined,
      };

      const created = await api.createDiagram(projectId, createData);

      // Reset all editor state for the new diagram
      setShowDescriptionView(false);
      setIsDescriptionPinned(false);
      setShowFloatingSidebar(false);
      setShowAppearanceEditor(false);
      setShowChatPanel(false);
      setShowCodeView(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDiagramDescription("");
      setBackgroundColor("#ffffff");
      setBackgroundPattern(newDiagramType === "mermaid" ? "grid" : "plain");
      setPreferredProvider(null);
      setPreferredModel(null);
      setDescriptionFontSize(14);
      setDescriptionPanelWidth(384);
      setSaveStatus("idle");
      setLastSavedTime(null);
      setError(null);

      // Set current diagram and navigate
      setCurrentDiagram(created);
      setDiagramCode(created.content);
      setDiagramDescription(created.description || "");
      setDiagramTitle(created.title);
      setSelectedFolderId(created.folder_id || null);
      setActiveTab("code");

      // Close modal and reload project
      setShowNewDiagramModal(false);
      setNewDiagramName("");
      setNewDiagramFolderId(null);
      setNewDiagramType("mermaid"); // Reset to default
      setIsFirstDiagram(false); // Reset first diagram state

      await loadProject();
      navigate(`/projects/${projectId}/diagrams/${created.id}`, {
        replace: true,
      });
    } catch (err: any) {
      console.error("Error creating diagram:", err);
      const detail = err.response?.data?.detail;
      if (detail?.error === "resource_limit_exceeded") {
        setShowNewDiagramModal(false);
        setUpgradePlan({
          resourceType: detail.resource_type,
          currentUsage: detail.current_usage,
          limit: detail.limit,
        });
      } else {
        setError("Error al crear diagrama");
      }
    } finally {
      setCreatingDiagram(false);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => prev + 0.1); // Sin límite máximo
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.1)); // Mínimo 10%
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Inline editing handlers
  const handleStartEditDiagramTitle = () => {
    setEditingDiagramTitle(diagramTitle);
    setIsEditingDiagramTitle(true);
  };

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingDiagramTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingDiagramTitle]);

  const handleSaveDiagramTitle = async () => {
    if (!editingDiagramTitle.trim() || !currentDiagram) {
      setIsEditingDiagramTitle(false);
      return;
    }

    const newTitle = editingDiagramTitle.trim();
    if (newTitle === diagramTitle) {
      setIsEditingDiagramTitle(false);
      return;
    }

    try {
      setDiagramTitle(newTitle);
      setIsEditingDiagramTitle(false);

      // Guardar en el backend
      await api.updateDiagram(currentDiagram.id, { title: newTitle });

      // Actualizar en el proyecto
      if (project) {
        const updatedProject = { ...project };
        const updateDiagramInList = (diagrams: Diagram[]) => {
          return diagrams.map((d) =>
            d.id === currentDiagram.id ? { ...d, title: newTitle } : d,
          );
        };

        updatedProject.diagrams = updateDiagramInList(updatedProject.diagrams);
        updatedProject.folders = updatedProject.folders.map((folder) => ({
          ...folder,
          diagrams: updateDiagramInList(folder.diagrams),
        }));

        setProject(updatedProject);
      }
    } catch (err) {
      console.error("Error updating diagram title:", err);
      setDiagramTitle(diagramTitle); // Revertir en caso de error
    }
  };

  const handleCancelEditDiagramTitle = () => {
    setIsEditingDiagramTitle(false);
    setEditingDiagramTitle("");
  };

  // Generate description with AI
  const handleGenerateDescription = async () => {
    if (!validateAIConfiguration()) return;

    if (!diagramCode.trim()) {
      alert(t("ai.generate.error"));
      return;
    }

    setGeneratingDescription(true);
    try {
      const response = await api.generateDescription({
        diagram_code: diagramCode,
        diagram_type: currentDiagram?.diagram_type || "mermaid",
        language: user?.language || "es",
        ...(preferredProvider ? { provider: preferredProvider as any } : {}),
      });

      // Store generated description and show confirmation modal
      setGeneratedDescription(response.description);
      setShowDescriptionConfirmModal(true);
    } catch (error: any) {
      if (error.response?.status === 404) {
        alert(t("ai.messages.noProvidersError"));
      } else {
        alert(error.response?.data?.detail || t("ai.generate.error"));
      }
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleAcceptDescription = async () => {
    setDiagramDescription(generatedDescription);

    // Auto-save if we have a current diagram
    if (currentDiagram && projectId) {
      try {
        await api.updateDiagram(currentDiagram.id, {
          description: generatedDescription,
        });
        setSaveStatus("saved");
        setLastSavedTime(new Date());
      } catch (error) {
        console.error("Error saving description:", error);
      }
    }

    setShowDescriptionConfirmModal(false);
    setGeneratedDescription("");
  };

  const handleRejectDescription = () => {
    setShowDescriptionConfirmModal(false);
    setGeneratedDescription("");
    setRefineInput("");
  };

  const handleRefineDescription = async () => {
    if (!refineInput.trim()) return;

    setRefining(true);
    try {
      const response = await api.refineDescription({
        diagram_code: diagramCode,
        diagram_type: currentDiagram?.diagram_type || "mermaid",
        current_description: generatedDescription,
        refinement_request: refineInput.trim(),
        language: user?.language || "es",
        ...(preferredProvider ? { provider: preferredProvider as any } : {}),
      });
      setGeneratedDescription(response.description);
      setRefineInput("");
    } catch (error: any) {
      alert(error.response?.data?.detail || t("ai.generate.error"));
    } finally {
      setRefining(false);
    }
  };

  // Copy diagram code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(diagramCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      console.error("Error copying code:", err);
    }
  };

  // Improve diagram with AI
  const handleImproveAccept = async (improvedCode: string) => {
    setDiagramCode(improvedCode);
    setSaveStatus("idle");

    // Auto-save if we have a current diagram
    if (currentDiagram && projectId) {
      try {
        await api.updateDiagram(currentDiagram.id, {
          content: improvedCode,
        });
        setSaveStatus("saved");
        setLastSavedTime(new Date());
      } catch (error: any) {
        console.error("Error saving improved diagram:", error);
        setSaveStatus("idle");
      }
    }
  };

  // Ajustar diagrama a pantalla
  const handleFitToScreen = () => {
    if (!mermaidRef.current || !containerRef.current) return;

    const diagramElement = mermaidRef.current;
    const containerElement = containerRef.current;

    // Obtener dimensiones del diagrama y contenedor
    const diagramRect = diagramElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // Guard against zero-dimension diagrams (e.g. SVG not yet rendered)
    if (
      diagramRect.width <= 0 ||
      diagramRect.height <= 0 ||
      containerRect.width <= 0 ||
      containerRect.height <= 0
    ) {
      return;
    }

    // Calcular el zoom necesario para ajustar (con un poco de padding)
    const scaleX = (containerRect.width * 0.9) / diagramRect.width;
    const scaleY = (containerRect.height * 0.9) / diagramRect.height;
    const newZoom = Math.min(scaleX, scaleY) * zoom; // Mantener el zoom actual como base

    // Guard against Infinity/NaN from edge cases
    if (!isFinite(newZoom) || newZoom <= 0) {
      return;
    }

    // Centrar el diagrama
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  };

  // Track if initial load is complete (to avoid fit-to-screen overriding restored viewport)
  const initialLoadComplete = useRef(false);

  // Mark initial load as complete after diagram loads
  useEffect(() => {
    if (currentDiagram && !initialLoadComplete.current) {
      // Wait for render to complete before marking as loaded
      const timer = setTimeout(() => {
        initialLoadComplete.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentDiagram]);

  // Ajustar diagrama cuando se abre/cierra el panel de descripción
  // Only after initial load to preserve restored viewport
  useEffect(() => {
    if (!initialLoadComplete.current) return;
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 300);
    return () => clearTimeout(timer);
  }, [showDescriptionView]);

  // Fix diagram handlers
  const handleFixSuccess = (response: FixDiagramResponse) => {
    setFixResult(response);
    setFixError(null);
    setShowFixDiffModal(true);
  };

  const handleFixError = (error: string) => {
    setFixError(error);
    setFixResult(null);
    // Show error notification for 5 seconds
    setTimeout(() => setFixError(null), 5000);
  };

  const handleApplyFix = () => {
    if (fixResult) {
      // Apply the corrected code
      setDiagramCode(fixResult.corrected_code);
      setShowFixDiffModal(false);
      setFixResult(null);
    }
  };

  const handleCancelFix = () => {
    setShowFixDiffModal(false);
    setFixResult(null);
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = async () => {
    if (isPanning && currentDiagram && projectId) {
      // Save viewport immediately when panning stops
      try {
        await api.updateDiagram(currentDiagram.id, {
          viewport_zoom: zoom,
          viewport_x: pan.x,
          viewport_y: pan.y,
        });
      } catch (err) {
        console.error("Error saving viewport on pan end:", err);
      }
    }
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.max(0.1, prev + delta)); // Sin límite máximo, mínimo 10%
  };

  // Export functions
  const createExportContent = async (): Promise<HTMLElement> => {
    const exportContainer = document.createElement("div");
    exportContainer.style.padding = "40px";
    exportContainer.style.backgroundColor = "white";
    exportContainer.style.fontFamily = "system-ui, -apple-system, sans-serif";

    // Add project info if enabled
    if (exportOptions.includeProjectInfo && project) {
      const projectHeader = document.createElement("div");
      projectHeader.style.marginBottom = "30px";
      projectHeader.style.borderBottom = "2px solid #e5e7eb";
      projectHeader.style.paddingBottom = "20px";

      const projectTitle = document.createElement("h1");
      projectTitle.textContent = project.name;
      projectTitle.style.fontSize = "28px";
      projectTitle.style.fontWeight = "bold";
      projectTitle.style.marginBottom = "10px";
      projectTitle.style.color = "#111827";
      projectHeader.appendChild(projectTitle);

      if (project.description) {
        const projectDesc = document.createElement("p");
        projectDesc.textContent = project.description;
        projectDesc.style.fontSize = "14px";
        projectDesc.style.color = "#6b7280";
        projectHeader.appendChild(projectDesc);
      }

      exportContainer.appendChild(projectHeader);
    }

    // Add diagram title
    const diagramHeader = document.createElement("div");
    diagramHeader.style.marginBottom = "20px";

    const title = document.createElement("h2");
    title.textContent = diagramTitle;
    title.style.fontSize = "24px";
    title.style.fontWeight = "600";
    title.style.color = "#111827";
    diagramHeader.appendChild(title);

    exportContainer.appendChild(diagramHeader);

    // Add diagram SVG
    if (mermaidRef.current) {
      const svgElement = mermaidRef.current.querySelector("svg");
      if (svgElement) {
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;
        clonedSvg.style.maxWidth = "100%";
        clonedSvg.style.height = "auto";
        clonedSvg.style.marginBottom = "30px";
        exportContainer.appendChild(clonedSvg);
      }
    }

    // Add description if enabled
    if (exportOptions.includeDescription && diagramDescription) {
      const descSection = document.createElement("div");
      descSection.style.marginTop = "30px";
      descSection.style.borderTop = "1px solid #e5e7eb";
      descSection.style.paddingTop = "20px";

      const descTitle = document.createElement("h3");
      descTitle.textContent = "Descripción";
      descTitle.style.fontSize = "18px";
      descTitle.style.fontWeight = "600";
      descTitle.style.marginBottom = "10px";
      descTitle.style.color = "#111827";
      descSection.appendChild(descTitle);

      const descContent = document.createElement("div");
      descContent.innerHTML = escapeHtml(diagramDescription).replace(
        /\n/g,
        "<br>",
      );
      descContent.style.fontSize = "14px";
      descContent.style.color = "#374151";
      descContent.style.lineHeight = "1.6";
      descSection.appendChild(descContent);

      exportContainer.appendChild(descSection);
    }

    return exportContainer;
  };

  const handleExportPNG = async () => {
    try {
      setExporting(true);
      const content = await createExportContent();
      document.body.appendChild(content);

      const canvas = await html2canvas(content, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      document.body.removeChild(content);

      const link = document.createElement("a");
      link.download = `${diagramTitle.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      setShowExportModal(false);
    } catch (err) {
      console.error("Error exporting PNG:", err);
      setError("Error al exportar PNG");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const content = await createExportContent();
      document.body.appendChild(content);

      const canvas = await html2canvas(content, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      document.body.removeChild(content);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${diagramTitle.replace(/\s+/g, "_")}.pdf`);

      setShowExportModal(false);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      setError("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSource = () => {
    const diagramTypeValue = currentDiagram?.diagram_type;
    const extension =
      diagramTypeValue === "plantuml"
        ? ".puml"
        : diagramTypeValue === "d2"
          ? ".d2"
          : ".mmd";
    const mimeType = "text/plain;charset=utf-8";
    const filename = `${diagramTitle.replace(/\s+/g, "_")}${extension}`;

    const blob = new Blob([diagramCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Folder functions
  const noop = () => {};
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFolder = async () => {
    if (!projectId || !newFolderName.trim()) return;

    try {
      setCreatingFolder(true);
      await api.createFolder(projectId, {
        name: newFolderName,
        color: newFolderColor,
      });

      // Reload project to get updated folders
      await loadProject();

      setShowNewFolderModal(false);
      setNewFolderName("");
      setNewFolderColor("#3B82F6");
    } catch (err) {
      console.error("Error creating folder:", err);
      setError("Error al crear carpeta");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleEditFolder = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleSaveFolderEdit = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;

    try {
      await api.updateFolder(editingFolderId, {
        name: editingFolderName.trim(),
      });
      await loadProject();
      setEditingFolderId(null);
      setEditingFolderName("");
    } catch (err) {
      console.error("Error updating folder:", err);
    }
  };

  const handleCancelFolderEdit = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleDeleteFolder = (
    folderId: string,
    folderName: string,
    diagramCount: number,
  ) => {
    setDeleteFolderModal({
      isOpen: true,
      folderId,
      folderName,
      diagramCount,
    });
  };

  const confirmDeleteFolder = async (deleteDiagrams: boolean) => {
    if (!deleteFolderModal.folderId) return;

    console.log("Deleting folder with deleteDiagrams:", deleteDiagrams);
    try {
      await api.deleteFolder(deleteFolderModal.folderId, deleteDiagrams);
      await loadProject();
    } catch (err) {
      console.error("Error deleting folder:", err);
      setError("Error al eliminar carpeta");
    }
  };

  // Delete diagram functions
  const handleDeleteDiagram = (diagramId: string, diagramName: string) => {
    setDeleteDiagramModal({
      isOpen: true,
      diagramId,
      diagramName,
    });
  };

  const confirmDeleteDiagram = async () => {
    if (!deleteDiagramModal.diagramId || !projectId) return;

    try {
      await api.deleteDiagram(deleteDiagramModal.diagramId);

      // If the deleted diagram is the current one, navigate to project
      if (deleteDiagramModal.diagramId === currentDiagram?.id) {
        navigate(`/projects/${projectId}`);
      }

      await loadProject();
      setDeleteDiagramModal({
        isOpen: false,
        diagramId: null,
        diagramName: "",
      });
    } catch (err) {
      console.error("Error deleting diagram:", err);
      setError("Error al eliminar diagrama");
    }
  };

  // Drag & drop functions
  const handleDragStart = (diagramId: string) => {
    setDraggedDiagramId(diagramId);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDropTargetFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDropTargetFolderId(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetFolderId: string | null,
  ) => {
    e.preventDefault();

    if (!draggedDiagramId) return;

    try {
      // Update diagram's folder
      await api.updateDiagram(draggedDiagramId, {
        folder_id: targetFolderId,
      });

      // Reload project to update folder structure
      await loadProject();

      // If the dropped diagram is the current one, update selected folder
      if (currentDiagram?.id === draggedDiagramId) {
        setSelectedFolderId(targetFolderId);
      }
    } catch (err) {
      console.error("Error moving diagram:", err);
      setError("Error al mover diagrama");
    } finally {
      setDraggedDiagramId(null);
      setDropTargetFolderId(null);
    }
  };

  if (loading) {
    return <EditorSkeleton />;
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Unified Toolbar */}
      {!isFullscreen && !isMobile && (
        <div className="flex items-center h-9 px-3 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
          {/* Left: project name + diagram title */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Project name with selector */}
            <div className="relative" ref={projectSelectorRef}>
              <button
                onClick={handleOpenProjectSelector}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 max-w-[140px]"
                title={project?.name || ""}
              >
                <span className="truncate">{project?.name || "Proyecto"}</span>
                <svg
                  className="w-3 h-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {/* Project selector dropdown */}
              {showProjectSelector && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <input
                      type="text"
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      placeholder={t("breadcrumb.searchProjects")}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 focus:ring-1 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {loadingProjects ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 text-center">
                        {t("common.loading")}
                      </p>
                    ) : filteredProjects.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 text-center">
                        {t("breadcrumb.noProjectsFound")}
                      </p>
                    ) : (
                      filteredProjects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProject(p.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                            p.id === projectId
                              ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <span>{p.emoji || "📁"}</span>
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Separator */}
            <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
            {/* Structure toggle (folder icon) */}
            <Tooltip content={t("editor.structure")} position="bottom">
              <button
                onClick={() => setShowFloatingSidebar(!showFloatingSidebar)}
                className={`floating-sidebar-button p-1 rounded-md transition-colors flex-shrink-0 ${showFloatingSidebar ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}
                aria-label={t("editor.structure")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </button>
            </Tooltip>
            {/* Diagram title */}
            {isEditingDiagramTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editingDiagramTitle}
                onChange={(e) => setEditingDiagramTitle(e.target.value)}
                onBlur={handleSaveDiagramTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDiagramTitle();
                  if (e.key === "Escape") handleCancelEditDiagramTitle();
                }}
                className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-purple-500 outline-none px-1 py-0.5 max-w-[200px]"
                aria-label={t("editor.editDiagramTitle")}
              />
            ) : (
              <button
                onClick={handleStartEditDiagramTitle}
                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors truncate max-w-[200px] flex items-center gap-1"
                title={t("editor.clickToEditTitle")}
              >
                <span className="truncate">{diagramTitle}</span>
                <svg
                  className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
            {/* New diagram button — hidden when editing title */}
            {!isEditingDiagramTitle && (
              <button
                onClick={() => handleNewDiagram(null)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors flex-shrink-0"
                aria-label={t("editor.newDiagram")}
                title={t("editor.newDiagram")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
          </div>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Right: all toolbar buttons */}
          <div className="flex items-center gap-0.5">
            {/* Code toggle */}
            <Tooltip content={t("editor.code")} position="bottom">
              <button
                onClick={() => setShowCodeView(!showCodeView)}
                className={`floating-code-button p-1.5 rounded-md transition-colors ${showCodeView ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}
                aria-label={t("editor.code")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Description toggle */}
            <Tooltip content={t("editor.description")} position="bottom">
              <button
                onClick={() => setShowDescriptionView(!showDescriptionView)}
                className={`floating-description-button p-1.5 rounded-md transition-colors ${showDescriptionView ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}
                aria-label={t("editor.description")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Appearance toggle */}
            <Tooltip content={t("editor.appearance")} position="bottom">
              <button
                onClick={() => setShowAppearanceEditor(!showAppearanceEditor)}
                className={`floating-appearance-button p-1.5 rounded-md transition-colors ${showAppearanceEditor ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}
                aria-label={t("editor.appearance")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* AI Chat button */}
            <Tooltip content={t("editor.aiChat")} position="bottom">
              <button
                onClick={() => {
                  if (validateAIConfiguration()) setShowChatPanel(true);
                }}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${showChatPanel ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/50"}`}
                aria-label={t("editor.aiChat")}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 2C10 5.866 7.866 8 4 8C7.866 8 10 10.134 10 14C10 10.134 12.134 8 16 8C12.134 8 10 5.866 10 2Z" />
                  <path d="M18 8C18 10.21 16.71 11.5 14.5 11.5C16.71 11.5 18 12.79 18 15C18 12.79 19.29 11.5 21.5 11.5C19.29 11.5 18 10.21 18 8Z" />
                </svg>
                <span className="text-xs font-semibold">AI</span>
              </button>
            </Tooltip>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Export button */}
            <Tooltip content={t("editor.exportDiagram")} position="bottom">
              <button
                onClick={() => setShowExportModal(true)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={t("editor.exportDiagram")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Share button */}
            <Tooltip
              content={
                !diagramId
                  ? t("editor.saveDiagramFirst")
                  : t("editor.shareDiagram")
              }
              position="bottom"
            >
              <button
                onClick={() => setShowShareModal(true)}
                disabled={!diagramId}
                className={`p-1.5 rounded-md transition-colors ${!diagramId ? "text-gray-300 cursor-not-allowed dark:text-gray-600" : isShared ? "text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}
                aria-label={t("editor.shareDiagram")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
            </Tooltip>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Zoom controls */}
            <div className="hidden md:flex items-center gap-0.5">
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={t("editor.zoomOut")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
              </button>
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 min-w-[40px] text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={t("editor.zoomIn")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <button
                onClick={handleFitToScreen}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={t("editor.fitToScreen")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden md:block" />

            {/* Fullscreen toggle */}
            <Tooltip
              content={
                isFullscreen
                  ? t("editor.exitFullscreen")
                  : t("editor.fullscreen")
              }
              position="bottom"
            >
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={
                  isFullscreen
                    ? t("editor.exitFullscreen")
                    : t("editor.fullscreen")
                }
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isFullscreen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </>
                  )}
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex overflow-hidden transition-all ${showNewDiagramModal && isFirstDiagram ? "blur-sm" : ""}`}
      >
        {/* Editor and Preview */}
        <main className="flex-1 flex overflow-hidden">
          {(() => {
            const codeEditorPanel = (
              <DiagramCodePanel
                value={diagramCode}
                onChange={setDiagramCode}
                diagramType={currentDiagram?.diagram_type || "mermaid"}
                hasError={diagramError.hasError || !!renderError}
                errorMessage={
                  diagramError.errorMessage || renderError || undefined
                }
                onCopy={handleCopyCode}
                copied={codeCopied}
                onClose={() => setShowCodeView(false)}
                isVisible={showCodeView && !isMobile}
                diagramId={diagramId}
                onFixSuccess={handleFixSuccess}
                onFixError={handleFixError}
              />
            );

            const previewPanel = (
              <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800 relative h-full">
                {/* Floating Modals */}
                {/* Diagram Structure Modal */}
                {showFloatingSidebar && !isMobile && (
                  <div className="floating-sidebar absolute top-0 left-0 z-30 w-72 h-full sm:top-2 sm:left-2 sm:h-auto sm:max-h-[calc(100vh-200px)] sm:rounded-lg sm:shadow-xl sm:border sm:border-gray-200 sm:dark:border-gray-700 overflow-hidden">
                    <DiagramFileBrowser
                      projectName={project?.name || ""}
                      projectEmoji={project?.emoji}
                      projectId={projectId || ""}
                      diagrams={filteredSidebarData.diagrams}
                      folders={filteredSidebarData.folders}
                      currentDiagramId={currentDiagram?.id}
                      onClose={() => {
                        setShowFloatingSidebar(false);
                        setDiagramSearchQuery("");
                      }}
                      onNewDiagram={(folderId) => handleNewDiagram(folderId)}
                      onNewFolder={() => setShowNewFolderModal(true)}
                      onDeleteDiagram={handleDeleteDiagram}
                      onDeleteFolder={handleDeleteFolder}
                      onEditFolder={handleEditFolder}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      draggedDiagramId={draggedDiagramId}
                      dropTargetFolderId={dropTargetFolderId}
                      expandedFolders={expandedFolders}
                      onToggleFolder={toggleFolder}
                      editingFolderId={editingFolderId}
                      editingFolderName={editingFolderName}
                      onEditingFolderNameChange={setEditingFolderName}
                      onSaveFolderEdit={handleSaveFolderEdit}
                      onCancelFolderEdit={handleCancelFolderEdit}
                    />
                  </div>
                )}

                {/* Appearance Editor Modal */}
                {showAppearanceEditor &&
                  !isMobile &&
                  (currentDiagram?.diagram_type === "mermaid" ||
                    currentDiagram?.diagram_type === "plantuml" ||
                    currentDiagram?.diagram_type === "d2" ||
                    currentDiagram?.diagram_type === "dbml") && (
                    <div className="floating-appearance absolute top-0 left-0 sm:top-4 sm:left-4 z-30 w-full sm:w-80 h-full sm:h-auto bg-white dark:bg-gray-800 sm:rounded-lg shadow-xl sm:border border-gray-200 dark:border-gray-700 sm:max-h-[calc(100vh-100px)] overflow-y-auto">
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t("editor.diagramAppearance")}
                          </h3>
                          <button
                            onClick={() => setShowAppearanceEditor(false)}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Mermaid Configuration */}
                        {currentDiagram?.diagram_type === "mermaid" && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t("editor.theme")}
                              </label>
                              <select
                                value={diagramTheme}
                                onChange={(e) =>
                                  setDiagramTheme(e.target.value)
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="default">Default</option>
                                <option value="base">
                                  Base (Personalizable)
                                </option>
                                <option value="dark">Dark</option>
                                <option value="forest">Forest</option>
                                <option value="neutral">Neutral</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t("editor.layout")}
                              </label>
                              <select
                                value={diagramLayout}
                                onChange={(e) =>
                                  setDiagramLayout(e.target.value)
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="dagre">Dagre</option>
                                <option value="elk">ELK</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t("editor.style")}
                              </label>
                              <select
                                value={diagramLook}
                                onChange={(e) => setDiagramLook(e.target.value)}
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="classic">
                                  Classic (Tradicional)
                                </option>
                                <option value="neo">Neo (Moderno)</option>
                                <option value="handDrawn">
                                  Hand Drawn (Sketch)
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo de Líneas
                              </label>
                              <select
                                value={diagramCurve}
                                onChange={(e) =>
                                  setDiagramCurve(e.target.value)
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="basis">Suaves (Basis)</option>
                                <option value="linear">Rectas (Linear)</option>
                                <option value="step">Escalones (Step)</option>
                                <option value="stepBefore">
                                  Escalones Antes
                                </option>
                                <option value="stepAfter">
                                  Escalones Después
                                </option>
                              </select>
                            </div>

                            {/* Global Styling Options */}
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Estilos Globales
                              </p>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fuente
                                  </label>
                                  <select
                                    value={diagramFontFamily}
                                    onChange={(e) =>
                                      setDiagramFontFamily(e.target.value)
                                    }
                                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                                  >
                                    <option value="">Por defecto</option>
                                    <option value="Arial, sans-serif">
                                      Arial
                                    </option>
                                    <option value="Helvetica, sans-serif">
                                      Helvetica
                                    </option>
                                    <option value="Verdana, sans-serif">
                                      Verdana
                                    </option>
                                    <option value="Trebuchet MS, sans-serif">
                                      Trebuchet MS
                                    </option>
                                    <option value="Georgia, serif">
                                      Georgia
                                    </option>
                                    <option value="Courier New, monospace">
                                      Courier New
                                    </option>
                                    <option value="Times New Roman, serif">
                                      Times New Roman
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Tamaño de Fuente (px)
                                  </label>
                                  <select
                                    value={diagramFontSize}
                                    onChange={(e) =>
                                      setDiagramFontSize(e.target.value)
                                    }
                                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                                  >
                                    <option value="12">12px (Pequeño)</option>
                                    <option value="14">14px (Normal)</option>
                                    <option value="16">16px (Mediano)</option>
                                    <option value="18">18px (Grande)</option>
                                    <option value="20">
                                      20px (Muy Grande)
                                    </option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PlantUML Configuration */}
                        {currentDiagram?.diagram_type === "plantuml" && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tema
                              </label>
                              <select
                                value={plantUMLTheme}
                                onChange={(e) =>
                                  setPlantUMLTheme(e.target.value)
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="">Sin tema (por defecto)</option>
                                <optgroup label="🎨 Estilos Modernos">
                                  <option value="sketchy">
                                    Sketchy (Dibujado a mano)
                                  </option>
                                  <option value="sketchy-outline">
                                    Sketchy Outline
                                  </option>
                                  <option value="blueprint">
                                    Blueprint (Plano)
                                  </option>
                                  <option value="minty">Minty (Menta)</option>
                                  <option value="spacelab">Spacelab</option>
                                </optgroup>
                                <optgroup label="🌈 Temas de Color">
                                  <option value="bluegray">Blue Gray</option>
                                  <option value="cerulean">
                                    Cerulean (Azul cielo)
                                  </option>
                                  <option value="cerulean-outline">
                                    Cerulean Outline
                                  </option>
                                  <option value="materia">Materia</option>
                                  <option value="materia-outline">
                                    Materia Outline
                                  </option>
                                  <option value="lightgray">Light Gray</option>
                                  <option value="plain">Plain (Simple)</option>
                                </optgroup>
                                <optgroup label="🌙 Temas Oscuros">
                                  <option value="cyborg">
                                    Cyborg (Oscuro)
                                  </option>
                                  <option value="cyborg-outline">
                                    Cyborg Outline
                                  </option>
                                  <option value="superhero">
                                    Superhero (Oscuro)
                                  </option>
                                  <option value="superhero-outline">
                                    Superhero Outline
                                  </option>
                                  <option value="black-knight">
                                    Black Knight
                                  </option>
                                  <option value="hacker">
                                    Hacker (Verde Matrix)
                                  </option>
                                </optgroup>
                                <optgroup label="🕹️ Temas Retro">
                                  <option value="amiga">Amiga (Retro)</option>
                                  <option value="crt-amber">CRT Amber</option>
                                  <option value="crt-green">CRT Green</option>
                                  <option value="metal">Metal</option>
                                </optgroup>
                                <optgroup label="📄 Otros">
                                  <option value="resume-light">
                                    Resume Light
                                  </option>
                                  <option value="unitide">Unitide</option>
                                </optgroup>
                              </select>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                El tema se aplica automáticamente al código
                                PlantUML
                              </p>
                            </div>
                          </div>
                        )}

                        {/* D2 Configuration */}
                        {currentDiagram?.diagram_type === "d2" && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t("editor.theme")}
                              </label>
                              <select
                                value={d2ThemeId}
                                onChange={(e) =>
                                  setD2ThemeId(Number(e.target.value))
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <optgroup label="☀️ Light">
                                  {D2_THEMES.light.map((theme) => (
                                    <option key={theme.id} value={theme.id}>
                                      {theme.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="🌙 Dark">
                                  {D2_THEMES.dark.map((theme) => (
                                    <option key={theme.id} value={theme.id}>
                                      {theme.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="🖥️ Special">
                                  {D2_THEMES.special.map((theme) => (
                                    <option key={theme.id} value={theme.id}>
                                      {theme.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t("diagram.d2.themeHint")}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Background Customization - Always visible */}
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
                            Fondo del Visualizador
                          </p>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Color de Fondo
                              </label>
                              <div className="flex gap-1.5 flex-wrap">
                                {[
                                  { color: "#ffffff", name: "Blanco" },
                                  { color: "#e5e7eb", name: "Gris" },
                                  { color: "#1f2937", name: "Negro" },
                                  { color: "#10b981", name: "Verde" },
                                  { color: "#3b82f6", name: "Azul" },
                                  { color: "#c084fc", name: "Lavanda" },
                                  { color: "#f472b6", name: "Rosa" },
                                  { color: "#fbbf24", name: "Amarillo" },
                                ].map(({ color, name }) => (
                                  <button
                                    key={color}
                                    onClick={() => setBackgroundColor(color)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                                      backgroundColor === color
                                        ? "border-purple-500 ring-2 ring-purple-200"
                                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                                    }`}
                                    style={{ backgroundColor: color }}
                                    title={name}
                                  />
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Patrón de Fondo
                              </label>
                              <select
                                value={backgroundPattern}
                                onChange={(e) =>
                                  setBackgroundPattern(e.target.value)
                                }
                                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                              >
                                <option value="plain">
                                  ▭ Plano (Sin patrón)
                                </option>
                                <option value="dots">⚬ Puntos</option>
                                <option value="grid">⊞ Cuadrícula</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Controles de pantalla completa */}
                {isFullscreen && (
                  <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    {/* Indicador de modo pantalla completa */}
                    <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <span>{t("editor.presentationMode")}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300">
                        {t("editor.pressEscToExit")}
                      </span>
                    </div>

                    {/* Botón para salir */}
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors shadow-lg"
                      title="Salir de pantalla completa (Esc)"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Controles de zoom flotantes en pantalla completa */}
                {isFullscreen && activeTab === "code" && (
                  <div className="absolute bottom-4 right-4 z-50 bg-black bg-opacity-75 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2">
                    <button
                      onClick={handleZoomOut}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                      title="Reducir zoom"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 12H4"
                        />
                      </svg>
                    </button>
                    <span className="px-2 text-xs font-mono text-white min-w-[45px] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                      title="Aumentar zoom"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                    <div className="w-px h-6 bg-white bg-opacity-30 mx-1"></div>
                    <button
                      onClick={handleFitToScreen}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                      title="Ajustar a pantalla"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                      title="Restablecer vista (100%)"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <div
                  ref={containerRef}
                  className="flex-1 p-2 overflow-hidden"
                  onMouseDown={
                    activeTab === "code" ? handleMouseDown : undefined
                  }
                  onMouseMove={
                    activeTab === "code" ? handleMouseMove : undefined
                  }
                  onMouseUp={activeTab === "code" ? handleMouseUp : undefined}
                  onMouseLeave={
                    activeTab === "code" ? handleMouseUp : undefined
                  }
                  onWheel={activeTab === "code" ? handleWheel : undefined}
                  {...touchHandlers}
                  style={{
                    cursor: isPanning
                      ? "grabbing"
                      : activeTab === "code"
                        ? "grab"
                        : "default",
                    ...getBackgroundStyle(),
                  }}
                >
                  {activeTab === "code" ? (
                    <>
                      <div
                        className="flex items-center justify-center min-h-full"
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: "center",
                          transition: isPanning
                            ? "none"
                            : "transform 0.1s ease-out",
                        }}
                      >
                        <div ref={mermaidRef}></div>
                      </div>
                    </>
                  ) : (
                    <div className="prose prose-sm max-w-none overflow-auto h-full">
                      {diagramDescription ? (
                        <ReactMarkdown>{diagramDescription}</ReactMarkdown>
                      ) : (
                        <div className="text-gray-400 text-center py-12">
                          <p className="text-sm">{t("editor.noDescription")}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Barra de Estado Inferior */}
                {!isFullscreen && (
                  <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-1.5 sm:py-2">
                    <div className="flex items-center justify-between text-xs">
                      {/* Información del lado izquierdo */}
                      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-hide">
                        {/* Estado de guardado con timestamp */}
                        <div className="flex items-center gap-1.5">
                          {saveStatus === "saving" && (
                            <>
                              <svg
                                className="w-3.5 h-3.5 animate-spin text-purple-600"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              <span className="text-gray-600">
                                {t("editor.saving")}
                              </span>
                            </>
                          )}
                          {saveStatus === "saved" && lastSavedTime && (
                            <>
                              <svg
                                className="w-3.5 h-3.5 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span className="text-green-600">
                                Guardado {getTimeAgo(lastSavedTime)}
                              </span>
                            </>
                          )}
                          {saveStatus === "idle" && (
                            <span className="text-gray-400">
                              {t("editor.noChanges")}
                            </span>
                          )}
                        </div>

                        {/* Separador */}
                        <div className="h-3 w-px bg-gray-300"></div>

                        {/* Información del código */}
                        <div className="flex items-center gap-1 text-gray-500">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 12h16M4 18h16"
                            />
                          </svg>
                          <span>{diagramCode.split("\n").length} líneas</span>
                        </div>

                        {/* Información del zoom (solo cuando está visible) */}
                        {activeTab === "code" && (
                          <>
                            <div className="h-3 w-px bg-gray-300 hidden sm:block"></div>
                            <div className="hidden sm:flex items-center gap-1 text-gray-500">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                />
                              </svg>
                              <span>
                                {t("editor.zoom")}: {Math.round(zoom * 100)}%
                              </span>
                            </div>
                          </>
                        )}

                        {/* Tipo de diagrama */}
                        <div className="h-3 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                            />
                          </svg>
                          <span>
                            {currentDiagram?.diagram_type === "mermaid"
                              ? "Mermaid"
                              : currentDiagram?.diagram_type === "d2"
                                ? "D2"
                                : "PlantUML"}
                            {currentDiagram?.diagram_type === "mermaid" && (
                              <span className="text-gray-400 ml-1 hidden sm:inline">
                                • {diagramTheme} • {diagramLayout}
                              </span>
                            )}
                          </span>
                        </div>
                        {currentDiagram?.created_at && (
                          <>
                            <div className="h-3 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-gray-500 dark:text-gray-400">
                              {new Date(
                                currentDiagram.created_at,
                              ).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Fecha y hora actual con timezone del usuario */}
                      <div className="hidden sm:flex items-center gap-2">
                        <svg
                          className="w-3.5 h-3.5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {currentTime.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                            timeZone: user?.timezone || "UTC",
                          })}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {currentTime.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            timeZone: user?.timezone || "UTC",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <div className="flex h-full w-full overflow-hidden">
                {/* Code editor — always mounted, hidden via CSS when not active */}
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{
                    width:
                      showCodeView && !isMobile ? `${codePanelWidth}px` : "0px",
                    minWidth: showCodeView && !isMobile ? "200px" : "0px",
                    opacity: showCodeView && !isMobile ? 1 : 0,
                    transition: isResizingCode.current
                      ? "none"
                      : "width 200ms, opacity 200ms",
                  }}
                >
                  {codeEditorPanel}
                </div>
                {/* Draggable divider — only visible when code is shown */}
                {showCodeView && !isMobile && (
                  <div
                    onMouseDown={handleCodeResizeMouseDown}
                    className="flex-shrink-0 w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-purple-400 dark:hover:bg-purple-500 active:bg-purple-500 cursor-col-resize transition-colors flex items-center justify-center"
                  >
                    <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 rounded-full" />
                  </div>
                )}
                {/* Preview — always visible */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  {previewPanel}
                </div>
              </div>
            );
          })()}
        </main>

        {/* Description Side Panel */}
        {showDescriptionView && !isMobile && (
          <>
            {/* Resize handle — outside the overflow-hidden panel so it's always accessible */}
            <div
              onMouseDown={handleDescriptionResizeMouseDown}
              className="floating-description-resize-handle hidden sm:flex items-center justify-center w-2 cursor-col-resize hover:bg-purple-200 active:bg-purple-300 transition-colors flex-shrink-0 bg-gray-100 dark:bg-gray-700 border-l border-gray-200 dark:border-gray-700"
              title="Arrastrar para redimensionar"
            >
              <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
            <div
              className="floating-description fixed inset-0 sm:static sm:inset-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col flex-shrink-0 overflow-hidden z-40 sm:z-auto"
              style={{
                width:
                  typeof window !== "undefined" && window.innerWidth < 640
                    ? "100%"
                    : descriptionPanelWidth,
              }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t("editor.diagramDescription")}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-md px-1 py-0.5 mr-1">
                      <button
                        onClick={() =>
                          setDescriptionFontSize((prev) =>
                            Math.max(10, prev - 2),
                          )
                        }
                        disabled={descriptionFontSize <= 10}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Reducir tamaño de texto"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono min-w-[28px] text-center">
                        {descriptionFontSize}
                      </span>
                      <button
                        onClick={() =>
                          setDescriptionFontSize((prev) =>
                            Math.min(32, prev + 2),
                          )
                        }
                        disabled={descriptionFontSize >= 32}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Aumentar tamaño de texto"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        setIsDescriptionPinned(!isDescriptionPinned)
                      }
                      className={`p-1.5 rounded transition-colors ${
                        isDescriptionPinned
                          ? "text-purple-600 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                          : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      title={
                        isDescriptionPinned ? "Desfijar panel" : "Fijar panel"
                      }
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill={isDescriptionPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setShowDescriptionView(false);
                        setIsDescriptionPinned(false);
                      }}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {diagramDescription.trim() ? (
                  <button
                    onClick={() => {
                      setGeneratedDescription(diagramDescription);
                      setShowDescriptionConfirmModal(true);
                    }}
                    disabled={generatingDescription || !diagramCode.trim()}
                    className="w-full px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                      />
                    </svg>
                    <span>{t("ai.description.refineButton")}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription || !diagramCode.trim()}
                    className="w-full px-3 py-2 text-sm font-medium text-white btn-glass bg-gradient-to-r from-purple-600 to-purple-600 rounded-lg hover:from-purple-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {generatingDescription ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>{t("ai.generate.generating")}</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M10 2C10 5.866 7.866 8 4 8C7.866 8 10 10.134 10 14C10 10.134 12.134 8 16 8C12.134 8 10 5.866 10 2Z" />
                          <path d="M18 8C18 10.21 16.71 11.5 14.5 11.5C16.71 11.5 18 12.79 18 15C18 12.79 19.29 11.5 21.5 11.5C19.29 11.5 18 10.21 18 8Z" />
                          <path d="M17 16C17 17.657 16.157 18.5 14.5 18.5C16.157 18.5 17 19.343 17 21C17 19.343 17.843 18.5 19.5 18.5C17.843 18.5 17 17.657 17 16Z" />
                        </svg>
                        <span>{t("ai.generate.button")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  value={diagramDescription}
                  onChange={setDiagramDescription}
                  placeholder={t("editor.descriptionPlaceholder")}
                  minHeight="100%"
                  fontSize={descriptionFontSize}
                  maxLength={50000}
                />
              </div>
            </div>
          </>
        )}

        {/* Panel de Chat con IA */}
        {showChatPanel && (
          <>
            {/* Resize handle — outside the overflow-hidden panel so it's always accessible */}
            {!isMobile && (
              <div
                onMouseDown={handleChatResizeMouseDown}
                className="hidden sm:flex items-center justify-center w-2 cursor-col-resize hover:bg-purple-200 active:bg-purple-300 transition-colors flex-shrink-0 bg-gray-100 dark:bg-gray-700 border-l border-gray-200 dark:border-gray-700"
                title="Arrastrar para redimensionar"
              >
                <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
            )}
            <AIChatPanel
              isOpen={showChatPanel}
              onClose={() => setShowChatPanel(false)}
              diagramCode={diagramCode}
              diagramType={currentDiagram?.diagram_type || "mermaid"}
              diagramId={diagramId || ""}
              onAcceptImprovement={handleImproveAccept}
              aiSettings={aiSettings}
              preferredProvider={preferredProvider}
              preferredModel={preferredModel}
              panelWidth={chatPanelWidth}
              onPreferredModelChange={(provider, model) => {
                setPreferredProvider(provider);
                setPreferredModel(model);
              }}
            />
          </>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-auto overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("editor.exportDiagram")}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeDescription}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        includeDescription: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("editor.includeDescription")}
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeProjectInfo}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        includeProjectInfo: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("editor.includeProjectInfo")}
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {t("editor.selectFormat")}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportPNG}
                    disabled={exporting}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {exporting ? t("editor.exporting") : "PNG"}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    {exporting ? t("editor.exporting") : "PDF"}
                  </button>
                </div>
              </div>

              {/* Download source file */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {t("editor.downloadSource")}
                </p>
                <button
                  onClick={handleDownloadSource}
                  className="w-full px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  {currentDiagram?.diagram_type === "plantuml"
                    ? ".puml (PlantUML)"
                    : currentDiagram?.diagram_type === "d2"
                      ? ".d2 (D2)"
                      : ".mmd (Mermaid)"}
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400 dark:disabled:text-gray-600"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Diagram Modal */}
      {showNewDiagramModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full mx-4 ${isFirstDiagram ? "max-w-2xl" : "max-w-lg"}`}
          >
            {isFirstDiagram && (
              <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                  <svg
                    className="w-8 h-8 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  ¡Crea tu primer diagrama! 🎨
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {t("editor.startVisualizing")}
                </p>
              </div>
            )}

            {!isFirstDiagram && (
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("editor.newDiagram")}
                </h3>
              </div>
            )}

            <div
              className={`space-y-5 ${isFirstDiagram ? "px-8 py-6" : "px-6 py-4"}`}
            >
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t("editor.diagramName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDiagramName}
                  onChange={(e) => setNewDiagramName(e.target.value)}
                  placeholder={t("editor.diagramNamePlaceholder")}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
                {isFirstDiagram && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t("editor.diagramNameHint")}
                  </p>
                )}
              </div>

              {/* Diagram Type Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {t("editor.diagramType")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    {
                      type: "mermaid" as const,
                      icon: "🧜‍♀️",
                      name: "Mermaid",
                      desc: t("editor.mermaidDesc"),
                    },
                    {
                      type: "plantuml" as const,
                      icon: "🌱",
                      name: "PlantUML",
                      desc: t("editor.plantumlDesc"),
                    },
                    {
                      type: "d2" as const,
                      icon: "📐",
                      name: "D2",
                      desc: t("diagram.type.d2Description"),
                    },
                    {
                      type: "dbml" as const,
                      icon: "🗄️",
                      name: "DBML",
                      desc: t("diagram.type.dbmlDescription"),
                    },
                  ].map(({ type, icon, name, desc }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewDiagramType(type)}
                      className={`flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-all text-left ${
                        newDiagramType === type
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <span
                        className={`text-xl flex-shrink-0 ${newDiagramType === type ? "scale-110" : ""} transition-transform`}
                      >
                        {icon}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-semibold ${newDiagramType === type ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"}`}
                        >
                          {name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {desc}
                        </div>
                      </div>
                      {newDiagramType === type && (
                        <svg
                          className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 ml-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {!isFirstDiagram &&
                project?.folders &&
                project.folders.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Carpeta (opcional)
                    </label>
                    <select
                      value={newDiagramFolderId || ""}
                      onChange={(e) =>
                        setNewDiagramFolderId(e.target.value || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Sin carpeta (raíz)</option>
                      {project.folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {isFirstDiagram && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-purple-500 dark:text-purple-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        <strong>¿Qué sigue?</strong> Después de crear tu
                        diagrama, podrás escribir código Mermaid en el editor y
                        ver la visualización en tiempo real. ¡Es fácil y
                        poderoso!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`border-t border-gray-200 dark:border-gray-700 ${isFirstDiagram ? "px-8 py-6" : "px-6 py-4 flex justify-end gap-3"}`}
            >
              {isFirstDiagram ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCreateDiagram}
                    disabled={creatingDiagram || !newDiagramName.trim()}
                    className="w-full px-6 py-3 text-sm font-semibold bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingDiagram ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Creando diagrama...
                      </span>
                    ) : (
                      "Crear diagrama y empezar →"
                    )}
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    disabled={creatingDiagram}
                    className="w-full px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400 transition-colors"
                  >
                    Volver al dashboard
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowNewDiagramModal(false);
                      setNewDiagramName("");
                      setNewDiagramFolderId(null);
                      setIsFirstDiagram(false);
                    }}
                    disabled={creatingDiagram}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateDiagram}
                    disabled={creatingDiagram || !newDiagramName.trim()}
                    className="px-6 py-3 text-sm font-semibold bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingDiagram ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Creando diagrama...
                      </span>
                    ) : (
                      "Crear Diagrama"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("editor.newFolder")}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre de la carpeta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t("editor.folderNamePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "#3B82F6",
                    "#10B981",
                    "#F59E0B",
                    "#EF4444",
                    "#8B5CF6",
                    "#EC4899",
                    "#06B6D4",
                    "#F97316",
                    "#84CC16",
                    "#6366F1",
                    "#14B8A6",
                    "#A855F7",
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                        newFolderColor === color
                          ? "border-gray-900 dark:border-white scale-110 ring-2 ring-purple-300"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName("");
                  setNewFolderColor("#3B82F6");
                }}
                disabled={creatingFolder}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:text-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-4 py-2 text-sm bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {creatingFolder ? "Creando..." : "Crear Carpeta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-lg">
          {error}
        </div>
      )}

      {/* Delete Folder Confirmation Modal */}
      <DeleteFolderModal
        isOpen={deleteFolderModal.isOpen}
        onClose={() =>
          setDeleteFolderModal({
            isOpen: false,
            folderId: null,
            folderName: "",
            diagramCount: 0,
          })
        }
        onConfirm={confirmDeleteFolder}
        folderName={deleteFolderModal.folderName}
        diagramCount={deleteFolderModal.diagramCount}
      />

      {/* Delete Diagram Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteDiagramModal.isOpen}
        onClose={() =>
          setDeleteDiagramModal({
            isOpen: false,
            diagramId: null,
            diagramName: "",
          })
        }
        onConfirm={confirmDeleteDiagram}
        title="Eliminar diagrama"
        message={`¿Estás seguro de que quieres eliminar el diagrama "${deleteDiagramModal.diagramName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
      />

      <NoAIProviderModal
        isOpen={showNoAIModal}
        onClose={() => setShowNoAIModal(false)}
      />

      <UpgradePlanModal
        isOpen={!!upgradePlan}
        onClose={() => setUpgradePlan(null)}
        resourceType={upgradePlan?.resourceType || ""}
        currentUsage={upgradePlan?.currentUsage || 0}
        limit={upgradePlan?.limit || 0}
      />

      {/* Share Diagram Modal */}
      {diagramId && (
        <ShareDiagramModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            checkSharedStatus(diagramId);
          }}
          diagramId={diagramId}
          diagramTitle={diagramTitle}
        />
      )}

      {/* Fix Diagram Diff Modal */}
      {showFixDiffModal && fixResult && (
        <DiagramDiffView
          originalCode={fixResult.original_code}
          correctedCode={fixResult.corrected_code}
          explanation={fixResult.explanation}
          changesSummary={fixResult.changes_summary}
          diagramType={currentDiagram?.diagram_type}
          onApply={handleApplyFix}
          onCancel={handleCancelFix}
        />
      )}

      {/* Fix Error Notification */}
      {fixError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md shadow-lg max-w-md z-50">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold text-sm">
                Error al corregir diagrama
              </p>
              <p className="text-sm mt-1">{fixError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Description Confirmation Modal */}
      {showDescriptionConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t("ai.description.modalTitle")}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t("ai.description.modalSubtitle")}
                  </p>
                </div>
                <button
                  onClick={handleRejectDescription}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content - Markdown Preview */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {refining ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-8 w-8 text-purple-600 mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">
                      {t("ai.description.refining")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-code:text-purple-700 dark:prose-code:text-purple-300 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/30 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {generatedDescription}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Refine Input */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !refining && refineInput.trim()) {
                      handleRefineDescription();
                    }
                  }}
                  placeholder={t("ai.description.refinePlaceholder")}
                  disabled={refining}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={handleRefineDescription}
                  disabled={refining || !refineInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {refining ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>{t("ai.description.refining")}</span>
                    </>
                  ) : (
                    <span>{t("ai.description.refineButton")}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Footer - Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={handleRejectDescription}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t("ai.description.reject")}
              </button>
              <button
                onClick={handleAcceptDescription}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                {t("ai.description.accept")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom toolbar — replaces top toolbar on small screens */}
      {isMobile && !isFullscreen && (
        <MobileBottomToolbar
          onToggleCode={() => {
            setShowCodeView(!showCodeView);
            setShowChatPanel(false);
          }}
          onToggleDescription={() => {
            setShowDescriptionView(!showDescriptionView);
            setShowChatPanel(false);
          }}
          onToggleFileBrowser={() => {
            setShowFloatingSidebar(!showFloatingSidebar);
            setShowChatPanel(false);
          }}
          onToggleAppearance={() => {
            setShowAppearanceEditor(!showAppearanceEditor);
            setShowChatPanel(false);
          }}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onExport={() => setShowExportModal(true)}
          onShare={() => setShowShareModal(true)}
          onToggleChat={() => {
            if (validateAIConfiguration()) setShowChatPanel(!showChatPanel);
          }}
          isCodeOpen={showCodeView}
          isDescriptionOpen={showDescriptionView}
          isFullscreen={isFullscreen}
          isChatOpen={showChatPanel}
          isShared={isShared}
        />
      )}

      {/* Mobile bottom sheets for code and description panels */}
      {isMobile && (
        <>
          <BottomSheet
            isOpen={showCodeView}
            onClose={() => setShowCodeView(false)}
            height="h-[65vh]"
          >
            <DiagramCodePanel
              value={diagramCode}
              onChange={setDiagramCode}
              diagramType={currentDiagram?.diagram_type || "mermaid"}
              hasError={diagramError.hasError || !!renderError}
              errorMessage={
                diagramError.errorMessage || renderError || undefined
              }
              onCopy={handleCopyCode}
              copied={codeCopied}
              diagramId={diagramId}
              onFixSuccess={handleFixSuccess}
              onFixError={handleFixError}
              onClose={() => setShowCodeView(false)}
            />
          </BottomSheet>

          <BottomSheet
            isOpen={showDescriptionView}
            onClose={() => {
              setShowDescriptionView(false);
              setIsDescriptionPinned(false);
            }}
            title={t("editor.description")}
            height="h-[55vh]"
          >
            <div className="p-4 h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <MarkdownEditor
                  value={diagramDescription}
                  onChange={setDiagramDescription}
                  fontSize={descriptionFontSize}
                  onFontSizeChange={setDescriptionFontSize}
                  maxLength={50000}
                />
              </div>
              {/* AI Generate / Refine button — same as desktop */}
              <div className="flex-shrink-0 pt-3 border-t border-gray-100 dark:border-gray-700">
                {diagramDescription.trim() ? (
                  <button
                    onClick={() => {
                      setGeneratedDescription(diagramDescription);
                      setShowDescriptionConfirmModal(true);
                    }}
                    disabled={generatingDescription || !diagramCode.trim()}
                    className="w-full px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                      />
                    </svg>
                    <span>{t("ai.description.refineButton")}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription || !diagramCode.trim()}
                    className="w-full px-3 py-2 text-sm font-medium text-white btn-glass bg-gradient-to-r from-purple-600 to-purple-600 rounded-lg hover:from-purple-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {generatingDescription ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>{t("ai.generate.generating")}</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M10 2C10 5.866 7.866 8 4 8C7.866 8 10 10.134 10 14C10 10.134 12.134 8 16 8C12.134 8 10 5.866 10 2Z" />
                          <path d="M18 8C18 10.21 16.71 11.5 14.5 11.5C16.71 11.5 18 12.79 18 15C18 12.79 19.29 11.5 21.5 11.5C19.29 11.5 18 10.21 18 8Z" />
                        </svg>
                        <span>{t("ai.generate.button")}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </BottomSheet>

          <BottomSheet
            isOpen={showFloatingSidebar}
            onClose={() => setShowFloatingSidebar(false)}
            title={t("editor.structure")}
            height="h-[70vh]"
          >
            <DiagramFileBrowser
              projectName={project?.name || ""}
              projectEmoji={project?.emoji}
              projectId={projectId || ""}
              diagrams={project?.diagrams || []}
              folders={project?.folders || []}
              currentDiagramId={diagramId}
              onClose={() => setShowFloatingSidebar(false)}
              onNewDiagram={() => {
                setShowFloatingSidebar(false);
                setShowNewDiagramModal(true);
              }}
              onNewFolder={() => {
                setShowFloatingSidebar(false);
                setShowNewFolderModal(true);
              }}
              onDeleteDiagram={(id, name) =>
                setDeleteDiagramModal({
                  isOpen: true,
                  diagramId: id,
                  diagramName: name,
                })
              }
              onDeleteFolder={(id, name, count) =>
                setDeleteFolderModal({
                  isOpen: true,
                  folderId: id,
                  folderName: name,
                  diagramCount: count,
                })
              }
              onEditFolder={(id, name) => {
                setEditingFolderId(id);
                setEditingFolderName(name);
              }}
              onDragStart={(id) => setDraggedDiagramId(id)}
              onDragOver={noop}
              onDragLeave={noop}
              onDrop={noop}
              draggedDiagramId={draggedDiagramId}
              dropTargetFolderId={dropTargetFolderId}
              expandedFolders={expandedFolders}
              onToggleFolder={(folderId) => {
                toggleFolder(folderId);
              }}
              editingFolderId={editingFolderId}
              editingFolderName={editingFolderName}
              onEditingFolderNameChange={setEditingFolderName}
              onSaveFolderEdit={() => {
                // TODO: implement folder rename
                setEditingFolderId(null);
              }}
              onCancelFolderEdit={() => setEditingFolderId(null)}
            />
          </BottomSheet>

          <BottomSheet
            isOpen={showAppearanceEditor}
            onClose={() => setShowAppearanceEditor(false)}
            title={t("editor.style")}
            height="h-[60vh]"
          >
            <div className="p-4 h-full overflow-y-auto space-y-4">
              {/* Theme / layout controls — reuse existing state */}
              {currentDiagram?.diagram_type === "mermaid" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t("editor.theme")}
                    </label>
                    <select
                      value={diagramTheme}
                      onChange={(e) => setDiagramTheme(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="default">Default</option>
                      <option value="dark">Dark</option>
                      <option value="forest">Forest</option>
                      <option value="neutral">Neutral</option>
                      <option value="base">Base</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t("editor.layout")}
                    </label>
                    <select
                      value={diagramLayout}
                      onChange={(e) => setDiagramLayout(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="dagre">Dagre</option>
                      <option value="elk">ELK</option>
                    </select>
                  </div>
                </>
              )}
              {/* Background controls */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("editor.backgroundColor")}
                </label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("editor.backgroundPattern")}
                </label>
                <select
                  value={backgroundPattern}
                  onChange={(e) => setBackgroundPattern(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="plain">{t("editor.plain")}</option>
                  <option value="dots">{t("editor.dots")}</option>
                  <option value="grid">{t("editor.grid")}</option>
                </select>
              </div>
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
