import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import mermaid from 'mermaid';
import plantumlEncoder from 'plantuml-encoder';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import api from '../services/api';
import { ProjectWithDiagrams, Diagram, CreateDiagramRequest, UpdateDiagramRequest, createMermaidConfig, createPlantUMLConfig } from '../types/project';
import Navbar from '../components/Navbar';
import Tabs from '../components/Tabs';
import DeleteFolderModal from '../components/DeleteFolderModal';
import ConfirmModal from '../components/ConfirmModal';
import Tooltip from '../components/Tooltip';

export default function DiagramEditorPage() {
  const { projectId, diagramId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const [diagramCode, setDiagramCode] = useState('graph TD\n  A[Start] --> B[End]');
  const [diagramTitle, setDiagramTitle] = useState('New Diagram');
  const [diagramDescription, setDiagramDescription] = useState('');
  const [diagramTheme, setDiagramTheme] = useState('default');
  const [diagramLayout, setDiagramLayout] = useState('dagre');
  const [diagramLook, setDiagramLook] = useState('classic');
  const [activeTab, setActiveTab] = useState<'code' | 'description'>('code');

  // Helper function to generate frontmatter
  const generateFrontmatter = (theme: string, layout: string, look: string): string => {
    return `---\nconfig:\n  theme: ${theme}\n  layout: ${layout}\n  look: ${look}\n---\n`;
  };

  // Helper function to format time ago
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 10) return 'justo ahora';
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  };

  // Generate full code with frontmatter for rendering
  const fullDiagramCode = useMemo(() => {
    if (currentDiagram?.diagram_type === 'mermaid') {
      return generateFrontmatter(diagramTheme, diagramLayout, diagramLook) + diagramCode;
    }
    return diagramCode;
  }, [diagramCode, diagramTheme, diagramLayout, diagramLook, currentDiagram]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Export options state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeDescription: true,
    includeProjectInfo: true,
  });
  const [exporting, setExporting] = useState(false);

  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Drag & drop state
  const [draggedDiagramId, setDraggedDiagramId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

  // New diagram modal state
  const [showNewDiagramModal, setShowNewDiagramModal] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [newDiagramFolderId, setNewDiagramFolderId] = useState<string | null>(null);
  const [newDiagramType, setNewDiagramType] = useState<'mermaid' | 'plantuml'>('mermaid');
  const [creatingDiagram, setCreatingDiagram] = useState(false);
  const [isFirstDiagram, setIsFirstDiagram] = useState(false);

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  // Collapsible panels state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Floating panels state
  const [showFloatingSidebar, setShowFloatingSidebar] = useState(false);
  const [showCodeView, setShowCodeView] = useState(false);
  const [showDescriptionView, setShowDescriptionView] = useState(false);
  const [showAppearanceEditor, setShowAppearanceEditor] = useState(false);

  // Inline editing state
  const [isEditingDiagramTitle, setIsEditingDiagramTitle] = useState(false);
  const [editingDiagramTitle, setEditingDiagramTitle] = useState('');

  // Close floating panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.floating-sidebar') && !target.closest('.floating-sidebar-button')) {
        setShowFloatingSidebar(false);
      }
      if (!target.closest('.floating-code') && !target.closest('.floating-code-button')) {
        setShowCodeView(false);
      }
      if (!target.closest('.floating-description') && !target.closest('.floating-description-button')) {
        setShowDescriptionView(false);
      }
      if (!target.closest('.floating-appearance') && !target.closest('.floating-appearance-button')) {
        setShowAppearanceEditor(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Delete confirmation modal state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [deleteFolderModal, setDeleteFolderModal] = useState<{ isOpen: boolean; folderId: string | null; folderName: string; diagramCount: number }>({
    isOpen: false,
    folderId: null,
    folderName: '',
    diagramCount: 0
  });

  // Delete diagram modal state
  const [deleteDiagramModal, setDeleteDiagramModal] = useState<{ isOpen: boolean; diagramId: string | null; diagramName: string }>({
    isOpen: false,
    diagramId: null,
    diagramName: ''
  });

  // SimpleMDE options
  const editorOptions = useMemo(() => {
    return {
      spellChecker: false,
      placeholder: 'Escribe la descripción del diagrama usando Markdown...',
      status: false,
      toolbar: [
        'bold',
        'italic',
        'heading',
        '|',
        'quote',
        'unordered-list',
        'ordered-list',
        '|',
        'link',
        'image',
        '|',
        'preview',
        'side-by-side',
        'fullscreen',
        '|',
        'guide',
      ],
      minHeight: '300px',
      maxHeight: '600px',
    };
  }, []);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
    });
  }, []);

  // Load project and diagram
  useEffect(() => {
    loadProject();
  }, [projectId, diagramId]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const projectData = await api.getProject(projectId);
      setProject(projectData);

      if (diagramId) {
        // Load existing diagram - check in root diagrams
        let diagram = projectData.diagrams.find(d => d.id === diagramId);
        let diagramFolderId = null;

        // If not found in root, check in folders
        if (!diagram) {
          for (const folder of projectData.folders) {
            diagram = folder.diagrams.find(d => d.id === diagramId);
            if (diagram) {
              diagramFolderId = folder.id;
              break;
            }
          }
        }

        if (diagram) {
          setCurrentDiagram(diagram);
          setDiagramCode(diagram.content);
          setDiagramDescription(diagram.description || '');
          setDiagramTitle(diagram.title);
          setDiagramTheme(diagram.config.mermaid?.theme || 'default');
          setDiagramLayout(diagram.config.mermaid?.layout || 'dagre');
          setDiagramLook(diagram.config.mermaid?.look || 'classic');
          setSelectedFolderId(diagram.folder_id || null);
          // Restore viewport position
          setZoom(diagram.viewport_zoom || 1);
          setPan({ x: diagram.viewport_x || 0, y: diagram.viewport_y || 0 });

          // If diagram is inside a folder, expand that folder
          if (diagramFolderId) {
            setExpandedFolders(prev => {
              const newSet = new Set(prev);
              newSet.add(diagramFolderId);
              return newSet;
            });
          }
        } else {
          setError('Diagram not found');
        }
      } else {
        // No diagramId in URL - select first diagram available
        let firstDiagram = null;

        // First, try to find a diagram outside of folders (root diagrams)
        if (projectData.diagrams.length > 0) {
          firstDiagram = projectData.diagrams[0];
        } else {
          // If no root diagrams, find first diagram in first folder
          for (const folder of projectData.folders) {
            if (folder.diagrams.length > 0) {
              firstDiagram = folder.diagrams[0];
              break;
            }
          }
        }

        if (firstDiagram) {
          // Navigate to the first diagram found
          navigate(`/projects/${projectId}/diagrams/${firstDiagram.id}`, { replace: true });
        } else {
          // No diagrams at all - show modal to create first diagram
          setIsFirstDiagram(true);
          setShowNewDiagramModal(true);
        }
      }
    } catch (err) {
      setError('Error loading project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Render diagram (Mermaid or PlantUML)
  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current) return;

      try {
        mermaidRef.current.innerHTML = '';

        // Detect diagram type
        const diagramType = currentDiagram?.diagram_type || 'mermaid';

        if (diagramType === 'plantuml') {
          // Render PlantUML using public server
          const encoded = plantumlEncoder.encode(diagramCode);
          const plantUMLServer = 'https://www.plantuml.com/plantuml/svg';
          const imageUrl = `${plantUMLServer}/${encoded}`;

          mermaidRef.current.innerHTML = `<img src="${imageUrl}" alt="PlantUML Diagram" class="max-w-full h-auto" />`;
        } else {
          // Render Mermaid with frontmatter config
          // Note: Mermaid will read the frontmatter automatically
          mermaid.initialize({
            startOnLoad: true,
            securityLevel: 'loose',
          });
          const id = `mermaid-${Date.now()}`;
          const { svg } = await mermaid.render(id, fullDiagramCode);
          mermaidRef.current.innerHTML = svg;
        }
      } catch (err) {
        mermaidRef.current.innerHTML = `<div class="text-red-500 p-4">Error rendering diagram: ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
      }
    };

    // Render immediately on first load, then with debounce for subsequent changes
    if (currentDiagram) {
      // If diagram just loaded, render immediately
      renderDiagram();
    } else {
      // For new diagrams or while editing, use debounce
      const debounce = setTimeout(renderDiagram, 300);
      return () => clearTimeout(debounce);
    }
  }, [fullDiagramCode, currentDiagram]);

  // Autosave effect for diagram content
  useEffect(() => {
    if (!currentDiagram || !projectId) return;

    const autoSave = async () => {
      try {
        setSaveStatus('saving');
        const updateData: UpdateDiagramRequest = {
          title: diagramTitle,
          content: diagramCode,
          description: diagramDescription,
          config: currentDiagram?.diagram_type === 'plantuml'
            ? createPlantUMLConfig()
            : createMermaidConfig(diagramTheme, diagramLayout, diagramLook),
          folder_id: selectedFolderId,
          viewport_zoom: zoom,
          viewport_x: pan.x,
          viewport_y: pan.y,
        };
        await api.updateDiagram(currentDiagram.id, updateData);
        setSaveStatus('saved');
        setLastSavedTime(new Date());

        // Update the project state to reflect the new title in the sidebar
        if (project) {
          const updatedProject = { ...project };

          // Update in root diagrams
          const rootDiagramIndex = updatedProject.diagrams.findIndex(d => d.id === currentDiagram.id);
          if (rootDiagramIndex !== -1) {
            updatedProject.diagrams[rootDiagramIndex] = {
              ...updatedProject.diagrams[rootDiagramIndex],
              title: diagramTitle,
              content: diagramCode,
              description: diagramDescription,
              folder_id: selectedFolderId
            };
          } else {
            // Update in folder diagrams
            for (const folder of updatedProject.folders) {
              const folderDiagramIndex = folder.diagrams.findIndex(d => d.id === currentDiagram.id);
              if (folderDiagramIndex !== -1) {
                folder.diagrams[folderDiagramIndex] = {
                  ...folder.diagrams[folderDiagramIndex],
                  title: diagramTitle,
                  content: diagramCode,
                  description: diagramDescription,
                  folder_id: selectedFolderId
                };
                break;
              }
            }
          }

          setProject(updatedProject);
        }

        // Hide "Guardado" after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch (err) {
        console.error('Error autosaving:', err);
        setSaveStatus('idle');
      }
    };

    const debounce = setTimeout(autoSave, 1500);
    return () => clearTimeout(debounce);
  }, [diagramCode, diagramDescription, diagramTitle, diagramTheme, diagramLayout, diagramLook, selectedFolderId]);

  // Separate effect for viewport changes (zoom/pan) - saves less frequently
  useEffect(() => {
    if (!currentDiagram || !projectId) return;

    const saveViewport = async () => {
      try {
        await api.updateDiagram(currentDiagram.id, {
          viewport_zoom: zoom,
          viewport_x: pan.x,
          viewport_y: pan.y,
        });
      } catch (err) {
        console.error('Error saving viewport:', err);
      }
    };

    // Longer debounce for viewport changes (only save after user stops moving for 1 second)
    const debounce = setTimeout(saveViewport, 1000);
    return () => clearTimeout(debounce);
  }, [zoom, pan]);

  const handleNewDiagram = (folderId: string | null = null) => {
    setNewDiagramName('');
    setNewDiagramFolderId(folderId);
    setIsFirstDiagram(false); // Always false when manually creating a diagram
    setShowNewDiagramModal(true);
  };

  const handleCreateDiagram = async () => {
    if (!projectId || !newDiagramName.trim()) return;

    try {
      setCreatingDiagram(true);

      // Define default content based on diagram type
      const defaultContent = newDiagramType === 'mermaid'
        ? 'graph TD\n  A[Start] --> B[End]'
        : '@startuml\nAlice -> Bob: Hello\nBob -> Alice: Hi!\n@enduml';

      const createData: CreateDiagramRequest = {
        title: newDiagramName,
        content: defaultContent,
        description: '',
        diagram_type: newDiagramType,
        folder_id: newDiagramFolderId,
      };

      const created = await api.createDiagram(projectId, createData);

      // Set current diagram and navigate
      setCurrentDiagram(created);
      setDiagramCode(created.content);
      setDiagramDescription(created.description || '');
      setDiagramTitle(created.title);
      setSelectedFolderId(created.folder_id || null);
      setActiveTab('code');

      // Close modal and reload project
      setShowNewDiagramModal(false);
      setNewDiagramName('');
      setNewDiagramFolderId(null);
      setNewDiagramType('mermaid'); // Reset to default
      setIsFirstDiagram(false); // Reset first diagram state

      await loadProject();
      navigate(`/projects/${projectId}/diagrams/${created.id}`, { replace: true });
    } catch (err) {
      console.error('Error creating diagram:', err);
      setError('Error al crear diagrama');
    } finally {
      setCreatingDiagram(false);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => prev + 0.1); // Sin límite máximo
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.1)); // Mínimo 10%
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
          return diagrams.map(d => d.id === currentDiagram.id ? { ...d, title: newTitle } : d);
        };

        updatedProject.diagrams = updateDiagramInList(updatedProject.diagrams);
        updatedProject.folders = updatedProject.folders.map(folder => ({
          ...folder,
          diagrams: updateDiagramInList(folder.diagrams)
        }));

        setProject(updatedProject);
      }
    } catch (err) {
      console.error('Error updating diagram title:', err);
      setDiagramTitle(diagramTitle); // Revertir en caso de error
    }
  };

  const handleCancelEditDiagramTitle = () => {
    setIsEditingDiagramTitle(false);
    setEditingDiagramTitle('');
  };

  // Ajustar diagrama a pantalla
  const handleFitToScreen = () => {
    if (!mermaidRef.current || !containerRef.current) return;

    const diagramElement = mermaidRef.current;
    const containerElement = containerRef.current;

    // Obtener dimensiones del diagrama y contenedor
    const diagramRect = diagramElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // Calcular el zoom necesario para ajustar (con un poco de padding)
    const scaleX = (containerRect.width * 0.9) / diagramRect.width;
    const scaleY = (containerRect.height * 0.9) / diagramRect.height;
    const newZoom = Math.min(scaleX, scaleY) * zoom; // Mantener el zoom actual como base

    // Centrar el diagrama
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
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
        console.error('Error saving viewport on pan end:', err);
      }
    }
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(0.1, prev + delta)); // Sin límite máximo, mínimo 10%
  };

  // Export functions
  const createExportContent = async (): Promise<HTMLElement> => {
    const exportContainer = document.createElement('div');
    exportContainer.style.padding = '40px';
    exportContainer.style.backgroundColor = 'white';
    exportContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Add project info if enabled
    if (exportOptions.includeProjectInfo && project) {
      const projectHeader = document.createElement('div');
      projectHeader.style.marginBottom = '30px';
      projectHeader.style.borderBottom = '2px solid #e5e7eb';
      projectHeader.style.paddingBottom = '20px';

      const projectTitle = document.createElement('h1');
      projectTitle.textContent = project.name;
      projectTitle.style.fontSize = '28px';
      projectTitle.style.fontWeight = 'bold';
      projectTitle.style.marginBottom = '10px';
      projectTitle.style.color = '#111827';
      projectHeader.appendChild(projectTitle);

      if (project.description) {
        const projectDesc = document.createElement('p');
        projectDesc.textContent = project.description;
        projectDesc.style.fontSize = '14px';
        projectDesc.style.color = '#6b7280';
        projectHeader.appendChild(projectDesc);
      }

      exportContainer.appendChild(projectHeader);
    }

    // Add diagram title
    const diagramHeader = document.createElement('div');
    diagramHeader.style.marginBottom = '20px';

    const title = document.createElement('h2');
    title.textContent = diagramTitle;
    title.style.fontSize = '24px';
    title.style.fontWeight = '600';
    title.style.color = '#111827';
    diagramHeader.appendChild(title);

    exportContainer.appendChild(diagramHeader);

    // Add diagram SVG
    if (mermaidRef.current) {
      const svgElement = mermaidRef.current.querySelector('svg');
      if (svgElement) {
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;
        clonedSvg.style.maxWidth = '100%';
        clonedSvg.style.height = 'auto';
        clonedSvg.style.marginBottom = '30px';
        exportContainer.appendChild(clonedSvg);
      }
    }

    // Add description if enabled
    if (exportOptions.includeDescription && diagramDescription) {
      const descSection = document.createElement('div');
      descSection.style.marginTop = '30px';
      descSection.style.borderTop = '1px solid #e5e7eb';
      descSection.style.paddingTop = '20px';

      const descTitle = document.createElement('h3');
      descTitle.textContent = 'Descripción';
      descTitle.style.fontSize = '18px';
      descTitle.style.fontWeight = '600';
      descTitle.style.marginBottom = '10px';
      descTitle.style.color = '#111827';
      descSection.appendChild(descTitle);

      const descContent = document.createElement('div');
      descContent.innerHTML = diagramDescription.replace(/\n/g, '<br>');
      descContent.style.fontSize = '14px';
      descContent.style.color = '#374151';
      descContent.style.lineHeight = '1.6';
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
        backgroundColor: '#ffffff',
        scale: 2,
      });

      document.body.removeChild(content);

      const link = document.createElement('a');
      link.download = `${diagramTitle.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting PNG:', err);
      setError('Error al exportar PNG');
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
        backgroundColor: '#ffffff',
        scale: 2,
      });

      document.body.removeChild(content);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${diagramTitle.replace(/\s+/g, '_')}.pdf`);

      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Error al exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  // Folder functions
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
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
      setNewFolderName('');
      setNewFolderColor('#3B82F6');
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Error al crear carpeta');
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
      await api.updateFolder(editingFolderId, { name: editingFolderName.trim() });
      await loadProject();
      setEditingFolderId(null);
      setEditingFolderName('');
    } catch (err) {
      console.error('Error updating folder:', err);
    }
  };

  const handleCancelFolderEdit = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleDeleteFolder = (folderId: string, folderName: string, diagramCount: number) => {
    setDeleteFolderModal({
      isOpen: true,
      folderId,
      folderName,
      diagramCount
    });
  };

  const confirmDeleteFolder = async (deleteDiagrams: boolean) => {
    if (!deleteFolderModal.folderId) return;

    console.log('Deleting folder with deleteDiagrams:', deleteDiagrams);
    try {
      await api.deleteFolder(deleteFolderModal.folderId, deleteDiagrams);
      await loadProject();
    } catch (err) {
      console.error('Error deleting folder:', err);
      setError('Error al eliminar carpeta');
    }
  };

  // Delete diagram functions
  const handleDeleteDiagram = (diagramId: string, diagramName: string) => {
    setDeleteDiagramModal({
      isOpen: true,
      diagramId,
      diagramName
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
      setDeleteDiagramModal({ isOpen: false, diagramId: null, diagramName: '' });
    } catch (err) {
      console.error('Error deleting diagram:', err);
      setError('Error al eliminar diagrama');
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

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
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
      console.error('Error moving diagram:', err);
      setError('Error al mover diagrama');
    } finally {
      setDraggedDiagramId(null);
      setDropTargetFolderId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {!isFullscreen && (
        <Navbar showBackToDashboard />
      )}

      {/* Toolbar Contextual Unificado */}
      {!isFullscreen && (
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            {/* Breadcrumbs y contexto */}
            <div className="flex items-center gap-2">
              {/* Proyecto */}
              <Tooltip content="Volver al proyecto" position="bottom">
                <button
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                >
                  <span className="text-lg">{project?.emoji || '📁'}</span>
                  <span className="font-medium">{project?.name}</span>
                </button>
              </Tooltip>

              {/* Separador */}
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* Carpeta (si existe) */}
              {selectedFolderId && project?.folders && (() => {
                const folder = project.folders.find(f => f.id === selectedFolderId);
                return folder ? (
                  <>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: `${folder.color}15` }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: folder.color }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: folder.color }}>{folder.name}</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                ) : null;
              })()}

              {/* Título del diagrama editable */}
              {isEditingDiagramTitle ? (
                <input
                  type="text"
                  value={editingDiagramTitle}
                  onChange={(e) => setEditingDiagramTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDiagramTitle();
                    if (e.key === 'Escape') handleCancelEditDiagramTitle();
                  }}
                  onBlur={handleSaveDiagramTitle}
                  className="text-sm font-medium text-gray-900 bg-white border border-blue-500 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  style={{ width: `${Math.max(editingDiagramTitle.length * 8, 100)}px` }}
                />
              ) : (
                <Tooltip content="Haz clic para editar el nombre" position="bottom">
                  <button
                    onClick={handleStartEditDiagramTitle}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded px-2 py-0.5 transition-colors flex items-center gap-1.5 group"
                  >
                    <span>{diagramTitle}</span>
                    <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              <span
                className={`ml-2 px-2 py-0.5 text-xs rounded-full ${currentDiagram?.diagram_type === 'mermaid'
                  ? 'bg-pink-100 text-pink-700'
                  : 'bg-green-100 text-green-700'
                  }`}
                title={`Tipo de diagrama: ${currentDiagram?.diagram_type === 'mermaid' ? 'Mermaid' : 'PlantUML'}`}
              >
                {currentDiagram?.diagram_type === 'mermaid' ? '🧜‍♀️ Mermaid' : '🌱 PlantUML'}
              </span>
            </div>

            {/* Controles centrales */}
            <div className="flex items-center gap-4">
              {/* Grupo de paneles */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <Tooltip content="Ver estructura del proyecto." position="bottom">
                  <button
                    onClick={() => setShowFloatingSidebar(!showFloatingSidebar)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showFloatingSidebar
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>Estructura</span>
                    </div>
                  </button>
                </Tooltip>
                <Tooltip content="Editar código del diagrama (Mermaid/PlantUML)" position="bottom">
                  <button
                    onClick={() => setShowCodeView(!showCodeView)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showCodeView
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <span>Código</span>
                    </div>
                  </button>
                </Tooltip>
                <Tooltip content="Agregar o editar descripción del diagrama (Markdown)" position="bottom">
                  <button
                    onClick={() => setShowDescriptionView(!showDescriptionView)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showDescriptionView
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Descripción</span>
                    </div>
                  </button>
                </Tooltip>
                <Tooltip content="Configurar tema, layout y estilo del diagrama" position="bottom">
                  <button
                    onClick={() => setShowAppearanceEditor(!showAppearanceEditor)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${showAppearanceEditor
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <span>Apariencia</span>
                    </div>
                  </button>
                </Tooltip>
              </div>

              {/* Separador */}
              <div className="h-6 w-px bg-gray-300"></div>

              {/* Grupo de zoom (solo visible cuando hay diagrama) */}
              {activeTab === 'code' && (
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                  <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Reducir zoom"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="px-2 text-xs font-mono text-gray-700 min-w-[45px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Aumentar zoom"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <button
                    onClick={handleFitToScreen}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Ajustar a pantalla"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Restablecer vista (100%)"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Separador */}
              <div className="h-6 w-px bg-gray-300"></div>

              {/* Grupo de acciones */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Exportar diagrama como PNG o PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Exportar</span>
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Modo presentación - Pantalla completa"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isFullscreen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex overflow-hidden transition-all ${showNewDiagramModal && isFirstDiagram ? 'blur-sm' : ''}`}>



        {/* Editor and Preview */}
        <main className="flex-1 flex overflow-hidden">


          {/* Preview */}
          <div className="flex-1 flex flex-col bg-gray-50 relative">

            {/* Floating Modals */}
            {/* Diagram Structure Modal */}
            {showFloatingSidebar && (
              <div className="floating-sidebar absolute top-4 left-4 z-30 w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">{project?.name}</h3>
                    <button
                      onClick={() => setShowFloatingSidebar(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleNewDiagram()}
                      className="flex-1 text-xs text-gray-600 hover:text-gray-900 text-left"
                    >
                      + Diagrama
                    </button>
                    <button
                      onClick={() => setShowNewFolderModal(true)}
                      className="flex-1 text-xs text-gray-600 hover:text-gray-900 text-left"
                    >
                      + Carpeta
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <div className="space-y-1">
                    {/* Diagrams without folder */}
                    {project?.diagrams.map(diagram => (
                      <div
                        key={diagram.id}
                        className={`group flex items-center gap-1 rounded transition-colors ${diagram.id === currentDiagram?.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                          } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                      >
                        <button
                          draggable
                          onDragStart={() => handleDragStart(diagram.id)}
                          onClick={() => {
                            navigate(`/projects/${projectId}/diagrams/${diagram.id}`);
                            setShowFloatingSidebar(false);
                          }}
                          className={`flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 cursor-move ${diagram.id === currentDiagram?.id
                            ? 'text-gray-900'
                            : 'text-gray-600'
                            }`}
                        >
                          <div className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center text-[10px] ${diagram.diagram_type === 'plantuml'
                            ? 'bg-green-100'
                            : 'bg-pink-100'
                            }`}>
                            {diagram.diagram_type === 'plantuml' ? '🌱' : '🧜‍♀️'}
                          </div>
                          <span className="truncate">{diagram.title}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDiagram(diagram.id, diagram.title);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar diagrama"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {/* Folders with diagrams */}
                    {project?.folders.map(folder => (
                      <div
                        key={folder.id}
                        className="space-y-1"
                        onDragOver={(e) => handleDragOver(e, folder.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, folder.id)}
                      >
                        <div className={`flex items-center gap-1 rounded transition-colors ${dropTargetFolderId === folder.id ? 'bg-blue-100' : ''
                          }`}>
                          {editingFolderId === folder.id ? (
                            <div className="flex-1 flex items-center gap-2 px-3 py-2">
                              <svg
                                className={`w-4 h-4 flex-shrink-0 transition-transform`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: folder.color }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <input
                                type="text"
                                value={editingFolderName}
                                onChange={(e) => setEditingFolderName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveFolderEdit();
                                  } else if (e.key === 'Escape') {
                                    handleCancelFolderEdit();
                                  }
                                }}
                                className="flex-1 text-sm font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveFolderEdit();
                                }}
                                className="p-1 text-green-600 hover:text-green-700 rounded"
                                title="Guardar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelFolderEdit();
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                title="Cancelar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleFolder(folder.id)}
                                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                              >
                                <svg
                                  className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-90' : ''
                                    }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: folder.color }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="truncate font-medium">{folder.name}</span>
                                <span className="text-xs text-gray-400">({folder.diagrams.length})</span>
                              </button>
                              <button
                                onClick={() => handleNewDiagram(folder.id)}
                                className="p-1 text-gray-400 hover:text-green-600 rounded"
                                title="Nuevo diagrama en esta carpeta"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEditFolder(folder.id, folder.name)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                title="Editar nombre de carpeta"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteFolder(folder.id, folder.name, folder.diagrams.length)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                                title="Eliminar carpeta"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>

                        {expandedFolders.has(folder.id) && (
                          <div className="ml-6 space-y-1">
                            {folder.diagrams.map(diagram => (
                              <div
                                key={diagram.id}
                                className={`group flex items-center gap-1 rounded transition-colors ${diagram.id === currentDiagram?.id
                                  ? 'bg-blue-50'
                                  : 'hover:bg-gray-50'
                                  } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                              >
                                <button
                                  draggable
                                  onDragStart={() => handleDragStart(diagram.id)}
                                  onClick={() => {
                                    navigate(`/projects/${projectId}/diagrams/${diagram.id}`);
                                    setShowFloatingSidebar(false);
                                  }}
                                  className={`flex-1 text-left px-3 py-2 text-sm flex items-center gap-2 cursor-move ${diagram.id === currentDiagram?.id
                                    ? 'text-gray-900'
                                    : 'text-gray-600'
                                    }`}
                                >
                                  <div className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center text-[10px] ${diagram.diagram_type === 'plantuml'
                                    ? 'bg-green-100'
                                    : 'bg-pink-100'
                                    }`}>
                                    {diagram.diagram_type === 'plantuml' ? '🌱' : '🧜‍♀️'}
                                  </div>
                                  <span className="truncate">{diagram.title}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDiagram(diagram.id, diagram.title);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar diagrama"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                            {folder.diagrams.length === 0 && (
                              <p className="text-xs text-gray-400 px-3 py-2">Sin diagramas</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {(!project?.diagrams || project.diagrams.length === 0) &&
                      (!project?.folders || project.folders.length === 0) && (
                        <p className="text-sm text-gray-400 px-3 py-2">Sin diagramas ni carpetas</p>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* Code View Modal */}
            {showCodeView && (
              <div className="floating-code absolute top-4 left-4 z-30 w-[28rem] bg-white rounded-lg shadow-xl border border-gray-200 max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Código del diagrama</h3>
                    <button
                      onClick={() => setShowCodeView(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <textarea
                    value={diagramCode}
                    onChange={(e) => setDiagramCode(e.target.value)}
                    className="w-full h-full min-h-[500px] font-mono text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="graph TD&#10;  A[Inicio] --> B[Proceso]&#10;  B --> C[Fin]"
                  />
                </div>
              </div>
            )}

            {/* Description View Modal */}
            {showDescriptionView && (
              <div className="floating-description absolute top-4 left-4 z-30 w-[32rem] bg-white rounded-lg shadow-xl border border-gray-200 max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Descripción del diagrama</h3>
                    <button
                      onClick={() => setShowDescriptionView(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <textarea
                    value={diagramDescription}
                    onChange={(e) => setDiagramDescription(e.target.value)}
                    className="w-full h-full min-h-[500px] text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Describe tu diagrama aquí..."
                  />
                </div>
              </div>
            )}

            {/* Appearance Editor Modal */}
            {showAppearanceEditor && currentDiagram?.diagram_type === 'mermaid' && (
              <div className="floating-appearance absolute top-4 left-4 z-30 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Apariencia del diagrama</h3>
                    <button
                      onClick={() => setShowAppearanceEditor(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">

                  {/* Mermaid Configuration */}
                  {currentDiagram?.diagram_type === 'mermaid' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tema</label>
                        <select
                          value={diagramTheme}
                          onChange={(e) => setDiagramTheme(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="default">Default</option>
                          <option value="dark">Dark</option>
                          <option value="forest">Forest</option>
                          <option value="neutral">Neutral</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Layout</label>
                        <select
                          value={diagramLayout}
                          onChange={(e) => setDiagramLayout(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="dagre">Dagre</option>
                          <option value="elk">ELK</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estilo</label>
                        <select
                          value={diagramLook}
                          onChange={(e) => setDiagramLook(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="classic">Classic</option>
                          <option value="modern">Modern</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Controles de pantalla completa */}
            {isFullscreen && (
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                {/* Indicador de modo pantalla completa */}
                <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Modo Presentación</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">Presiona Esc para salir</span>
                </div>

                {/* Botón para salir */}
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors shadow-lg"
                  title="Salir de pantalla completa (Esc)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Controles de zoom flotantes en pantalla completa */}
            {isFullscreen && activeTab === 'code' && (
              <div className="absolute bottom-4 right-4 z-50 bg-black bg-opacity-75 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                  title="Reducir zoom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <div className="w-px h-6 bg-white bg-opacity-30 mx-1"></div>
                <button
                  onClick={handleFitToScreen}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                  title="Ajustar a pantalla"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors text-white"
                  title="Restablecer vista (100%)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            )}

            <div
              ref={containerRef}
              className="flex-1 p-8 overflow-hidden"
              onMouseDown={activeTab === 'code' ? handleMouseDown : undefined}
              onMouseMove={activeTab === 'code' ? handleMouseMove : undefined}
              onMouseUp={activeTab === 'code' ? handleMouseUp : undefined}
              onMouseLeave={activeTab === 'code' ? handleMouseUp : undefined}
              onWheel={activeTab === 'code' ? handleWheel : undefined}
              style={{ cursor: isPanning ? 'grabbing' : (activeTab === 'code' ? 'grab' : 'default') }}
            >
              {activeTab === 'code' ? (
                <div
                  className="flex items-center justify-center min-h-full"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <div ref={mermaidRef}></div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none overflow-auto h-full">
                  {diagramDescription ? (
                    <ReactMarkdown>{diagramDescription}</ReactMarkdown>
                  ) : (
                    <div className="text-gray-400 text-center py-12">
                      <p className="text-sm">Sin descripción</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Barra de Estado Inferior */}
            {!isFullscreen && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-2">
                <div className="flex items-center justify-between text-xs">
                  {/* Información del lado izquierdo */}
                  <div className="flex items-center gap-4">
                    {/* Estado de guardado con timestamp */}
                    <div className="flex items-center gap-1.5">
                      {saveStatus === 'saving' && (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-gray-600">Guardando...</span>
                        </>
                      )}
                      {saveStatus === 'saved' && lastSavedTime && (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-600">Guardado {getTimeAgo(lastSavedTime)}</span>
                        </>
                      )}
                      {saveStatus === 'idle' && (
                        <span className="text-gray-400">Sin cambios</span>
                      )}
                    </div>

                    {/* Separador */}
                    <div className="h-3 w-px bg-gray-300"></div>

                    {/* Información del código */}
                    <div className="flex items-center gap-1 text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span>{diagramCode.split('\n').length} líneas</span>
                    </div>

                    {/* Información del zoom (solo cuando está visible) */}
                    {activeTab === 'code' && (
                      <>
                        <div className="h-3 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          <span>Zoom: {Math.round(zoom * 100)}%</span>
                        </div>
                      </>
                    )}

                    {/* Tipo de diagrama */}
                    <div className="h-3 w-px bg-gray-300"></div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <span>
                        {currentDiagram?.diagram_type === 'mermaid' ? 'Mermaid' : 'PlantUML'}
                        {currentDiagram?.diagram_type === 'mermaid' && (
                          <span className="text-gray-400 ml-1">
                            • {diagramTheme} • {diagramLayout}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Acciones del lado derecho */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/projects/${projectId}`)}
                      className="text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>Ver proyecto</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Exportar Diagrama</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeDescription}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeDescription: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Incluir descripción del diagrama</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeProjectInfo}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeProjectInfo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Incluir información del proyecto</span>
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-3">Selecciona el formato de exportación:</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportPNG}
                    disabled={exporting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {exporting ? 'Exportando...' : 'PNG'}
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {exporting ? 'Exportando...' : 'PDF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Diagram Modal */}
      {showNewDiagramModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 ${isFirstDiagram ? 'max-w-2xl' : 'max-w-md'}`}>
            {isFirstDiagram && (
              <div className="px-8 py-6 border-b border-gray-200 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Crea tu primer diagrama! 🎨</h3>
                <p className="text-gray-600">Comienza a visualizar tus ideas con diagramas de Mermaid</p>
              </div>
            )}

            {!isFirstDiagram && (
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Nuevo Diagrama</h3>
              </div>
            )}

            <div className={`space-y-4 ${isFirstDiagram ? 'px-8 py-6' : 'px-6 py-4'}`}>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nombre del diagrama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDiagramName}
                  onChange={(e) => setNewDiagramName(e.target.value)}
                  placeholder="Ej: Diagrama de flujo principal"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                {isFirstDiagram && (
                  <p className="mt-2 text-sm text-gray-500">Dale un nombre descriptivo a tu diagrama</p>
                )}
              </div>

              {/* Diagram Type Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Tipo de diagrama <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewDiagramType('mermaid')}
                    className={`p-4 border-2 rounded-lg transition-all ${newDiagramType === 'mermaid'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`text-2xl ${newDiagramType === 'mermaid' ? 'scale-110' : ''} transition-transform`}>
                        🧜‍♀️
                      </div>
                      <div className="text-center">
                        <div className={`font-semibold ${newDiagramType === 'mermaid' ? 'text-blue-700' : 'text-gray-700'}`}>
                          Mermaid
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Diagramas de flujo, secuencia, etc.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewDiagramType('plantuml')}
                    className={`p-4 border-2 rounded-lg transition-all ${newDiagramType === 'plantuml'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`text-2xl ${newDiagramType === 'plantuml' ? 'scale-110' : ''} transition-transform`}>
                        🌱
                      </div>
                      <div className="text-center">
                        <div className={`font-semibold ${newDiagramType === 'plantuml' ? 'text-blue-700' : 'text-gray-700'}`}>
                          PlantUML
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          UML, clases, componentes, etc.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {!isFirstDiagram && project?.folders && project.folders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Carpeta (opcional)
                  </label>
                  <select
                    value={newDiagramFolderId || ''}
                    onChange={(e) => setNewDiagramFolderId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin carpeta (raíz)</option>
                    {project.folders.map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isFirstDiagram && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        <strong>¿Qué sigue?</strong> Después de crear tu diagrama, podrás escribir código Mermaid en el editor
                        y ver la visualización en tiempo real. ¡Es fácil y poderoso!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`border-t border-gray-200 ${isFirstDiagram ? 'px-8 py-6' : 'px-6 py-4 flex justify-end gap-3'}`}>
              {isFirstDiagram ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCreateDiagram}
                    disabled={creatingDiagram || !newDiagramName.trim()}
                    className="w-full px-6 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingDiagram ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creando diagrama...
                      </span>
                    ) : (
                      'Crear diagrama y empezar →'
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    disabled={creatingDiagram}
                    className="w-full px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:text-gray-400 transition-colors"
                  >
                    Volver al dashboard
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowNewDiagramModal(false);
                      setNewDiagramName('');
                      setNewDiagramFolderId(null);
                      setIsFirstDiagram(false);
                    }}
                    disabled={creatingDiagram}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateDiagram}
                    disabled={creatingDiagram || !newDiagramName.trim()}
                    className="px-6 py-3 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingDiagram ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creando diagrama...
                      </span>
                    ) : (
                      'Crear Diagrama'
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nueva Carpeta</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ej: Diagramas de flujo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newFolderColor === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                  setNewFolderColor('#3B82F6');
                }}
                disabled={creatingFolder}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {creatingFolder ? 'Creando...' : 'Crear Carpeta'}
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
        onClose={() => setDeleteFolderModal({ isOpen: false, folderId: null, folderName: '', diagramCount: 0 })}
        onConfirm={confirmDeleteFolder}
        folderName={deleteFolderModal.folderName}
        diagramCount={deleteFolderModal.diagramCount}
      />

      {/* Delete Diagram Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteDiagramModal.isOpen}
        onClose={() => setDeleteDiagramModal({ isOpen: false, diagramId: null, diagramName: '' })}
        onConfirm={confirmDeleteDiagram}
        title="Eliminar diagrama"
        message={`¿Estás seguro de que quieres eliminar el diagrama "${deleteDiagramModal.diagramName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
      />
    </div>
  );
}
