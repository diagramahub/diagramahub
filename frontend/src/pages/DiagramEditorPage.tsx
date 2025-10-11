import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import api from '../services/api';
import { ProjectWithDiagrams, Diagram, CreateDiagramRequest, UpdateDiagramRequest } from '../types/project';
import Navbar from '../components/Navbar';
import Tabs from '../components/Tabs';

export default function DiagramEditorPage() {
  const { projectId, diagramId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectWithDiagrams | null>(null);
  const [currentDiagram, setCurrentDiagram] = useState<Diagram | null>(null);
  const [diagramCode, setDiagramCode] = useState('graph TD\n  A[Start] --> B[End]');
  const [diagramTitle, setDiagramTitle] = useState('New Diagram');
  const [diagramDescription, setDiagramDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'description'>('code');
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
  const [creatingDiagram, setCreatingDiagram] = useState(false);

  // Autosave state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

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
        
        // If not found in root, check in folders
        if (!diagram) {
          for (const folder of projectData.folders) {
            diagram = folder.diagrams.find(d => d.id === diagramId);
            if (diagram) break;
          }
        }
        
        if (diagram) {
          setCurrentDiagram(diagram);
          setDiagramCode(diagram.content);
          setDiagramDescription(diagram.description || '');
          setDiagramTitle(diagram.title);
          setSelectedFolderId(diagram.folder_id || null);
        } else {
          setError('Diagram not found');
        }
      }
    } catch (err) {
      setError('Error loading project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Render Mermaid diagram
  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current) return;

      try {
        mermaidRef.current.innerHTML = '';
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagramCode);
        mermaidRef.current.innerHTML = svg;
      } catch (err) {
        mermaidRef.current.innerHTML = `<div class="text-red-500 p-4">Error rendering diagram: ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
      }
    };

    const debounce = setTimeout(renderDiagram, 500);
    return () => clearTimeout(debounce);
  }, [diagramCode]);

  // Autosave effect
  useEffect(() => {
    if (!currentDiagram || !projectId) return;

    const autoSave = async () => {
      try {
        setSaveStatus('saving');
        const updateData: UpdateDiagramRequest = {
          title: diagramTitle,
          content: diagramCode,
          description: diagramDescription,
          folder_id: selectedFolderId,
        };
        await api.updateDiagram(currentDiagram.id, updateData);
        setSaveStatus('saved');
        
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
  }, [diagramCode, diagramDescription, diagramTitle, selectedFolderId, currentDiagram, projectId]);

  const handleNewDiagram = (folderId: string | null = null) => {
    setNewDiagramName('');
    setNewDiagramFolderId(folderId);
    setShowNewDiagramModal(true);
  };

  const handleCreateDiagram = async () => {
    if (!projectId || !newDiagramName.trim()) return;

    try {
      setCreatingDiagram(true);
      const createData: CreateDiagramRequest = {
        title: newDiagramName,
        content: 'graph TD\n  A[Start] --> B[End]',
        description: '',
        diagram_type: 'flowchart',
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
    setZoom(prev => Math.min(prev + 0.1, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
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

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
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

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta carpeta? Los diagramas se moverán a la raíz.')) return;

    try {
      await api.deleteFolder(folderId);
      await loadProject();
    } catch (err) {
      console.error('Error deleting folder:', err);
      setError('Error al eliminar carpeta');
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
      <Navbar showBackToDashboard />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with folders and diagrams */}
        <aside className="w-64 border-r border-gray-100 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900 truncate">{project?.name}</h2>
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
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {/* Diagrams without folder */}
              {project?.diagrams.map(diagram => (
                <button
                  key={diagram.id}
                  draggable
                  onDragStart={() => handleDragStart(diagram.id)}
                  onClick={() => navigate(`/projects/${projectId}/diagrams/${diagram.id}`)}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 cursor-move ${diagram.id === currentDiagram?.id
                      ? 'text-gray-900 bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-50'
                    } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate">{diagram.title}</span>
                </button>
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
                  <div className={`flex items-center gap-1 rounded transition-colors ${
                    dropTargetFolderId === folder.id ? 'bg-blue-100' : ''
                  }`}>
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
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Eliminar carpeta"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {expandedFolders.has(folder.id) && (
                    <div className="ml-6 space-y-1">
                      {folder.diagrams.map(diagram => (
                        <button
                          key={diagram.id}
                          draggable
                          onDragStart={() => handleDragStart(diagram.id)}
                          onClick={() => navigate(`/projects/${projectId}/diagrams/${diagram.id}`)}
                          className={`w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center gap-2 cursor-move ${diagram.id === currentDiagram?.id
                              ? 'text-gray-900 bg-blue-50'
                              : 'text-gray-600 hover:bg-gray-50'
                            } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate">{diagram.title}</span>
                        </button>
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
        </aside>

        {/* Editor and Preview */}
        <main className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="w-1/3 flex flex-col border-r border-gray-100">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
              <input
                type="text"
                value={diagramTitle}
                onChange={(e) => setDiagramTitle(e.target.value)}
                className="flex-1 text-base font-medium text-gray-900 bg-transparent border-none focus:outline-none placeholder-gray-400"
                placeholder="Título del diagrama"
              />
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Autosave status indicator */}
                {saveStatus !== 'idle' && (
                  <div className="flex items-center gap-2 text-xs">
                    {saveStatus === 'saving' && (
                      <>
                        <svg className="w-3 h-3 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-gray-600">Guardando...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-600">Guardado</span>
                      </>
                    )}
                  </div>
                )}
                
                <button
                  onClick={() => setShowExportModal(true)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar
                </button>
              </div>
            </div>

            {/* Folder Selector */}
            <div className="px-6 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-600"
                >
                  <option value="">Sin carpeta</option>
                  {project?.folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="text-xs text-gray-400 hover:text-blue-600 p-1"
                  title="Nueva carpeta"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              tabs={[
                {
                  id: 'code',
                  label: 'Código Mermaid',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  ),
                },
                {
                  id: 'description',
                  label: 'Descripción',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  ),
                },
              ]}
              activeTab={activeTab}
              onChange={(tabId) => setActiveTab(tabId as 'code' | 'description')}
            />

            {/* Tab Content */}
            <div className="flex-1 p-6 overflow-auto">
              {activeTab === 'code' ? (
                <textarea
                  value={diagramCode}
                  onChange={(e) => setDiagramCode(e.target.value)}
                  className="w-full h-full font-mono text-sm text-gray-700 bg-transparent border-none focus:outline-none resize-none placeholder-gray-400"
                  placeholder="graph TD&#10;  A[Inicio] --> B[Proceso]&#10;  B --> C[Fin]"
                />
              ) : (
                <div className="h-full">
                  <SimpleMDE
                    value={diagramDescription}
                    onChange={setDiagramDescription}
                    options={editorOptions}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="w-2/3 flex flex-col bg-gray-50 relative">
            {/* Zoom Controls - Only show for diagram view */}
            {activeTab === 'code' && (
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white rounded-lg shadow-md p-2 border border-gray-200">
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Zoom In"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Zoom Out"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Reset View"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className="text-xs text-gray-500 text-center px-1 py-1 border-t border-gray-200">
                  {Math.round(zoom * 100)}%
                </div>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Diagrama</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del diagrama *
                </label>
                <input
                  type="text"
                  value={newDiagramName}
                  onChange={(e) => setNewDiagramName(e.target.value)}
                  placeholder="Ej: Diagrama de flujo principal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

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
                  {project?.folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewDiagramModal(false);
                  setNewDiagramName('');
                  setNewDiagramFolderId(null);
                }}
                disabled={creatingDiagram}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDiagram}
                disabled={creatingDiagram || !newDiagramName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {creatingDiagram ? 'Creando...' : 'Crear Diagrama'}
              </button>
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
    </div>
  );
}
