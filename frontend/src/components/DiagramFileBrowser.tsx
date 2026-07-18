import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface DiagramItem {
  id: string;
  title: string;
  diagram_type: string;
  folder_id?: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  color: string;
  diagrams: DiagramItem[];
}

interface DiagramFileBrowserProps {
  projectName: string;
  projectEmoji?: string;
  projectId: string;
  diagrams: DiagramItem[];
  folders: FolderItem[];
  currentDiagramId?: string;
  onClose: () => void;
  onNewDiagram: (folderId?: string | null) => void;
  onNewFolder: () => void;
  onDeleteDiagram: (id: string, title: string) => void;
  onDeleteFolder: (id: string, name: string, count: number) => void;
  onEditFolder: (id: string, name: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, folderId: string | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderId: string | null) => void;
  draggedDiagramId: string | null;
  dropTargetFolderId: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  editingFolderId: string | null;
  editingFolderName: string;
  onEditingFolderNameChange: (name: string) => void;
  onSaveFolderEdit: () => void;
  onCancelFolderEdit: () => void;
  closeOnSelect?: boolean;
}

const DIAGRAM_ICONS: Record<string, string> = {
  mermaid: '🧜‍♀️',
  plantuml: '🌱',
  d2: '📐',
  dbml: '🗄️',
};

export default function DiagramFileBrowser({
  projectName,
  projectEmoji,
  projectId,
  diagrams,
  folders,
  currentDiagramId,
  onClose,
  onNewDiagram,
  onNewFolder,
  onDeleteDiagram,
  onDeleteFolder,
  onEditFolder,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedDiagramId,
  dropTargetFolderId,
  expandedFolders,
  onToggleFolder,
  editingFolderId,
  editingFolderName,
  onEditingFolderNameChange,
  onSaveFolderEdit,
  onCancelFolderEdit,
  closeOnSelect = true,
}: DiagramFileBrowserProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return { diagrams, folders };
    const fd = diagrams.filter(d => d.title.toLowerCase().includes(q));
    const ff = folders
      .map(f => ({ ...f, diagrams: f.diagrams.filter(d => d.title.toLowerCase().includes(q)) }))
      .filter(f => f.name.toLowerCase().includes(q) || f.diagrams.length > 0);
    return { diagrams: fd, folders: ff };
  }, [diagrams, folders, searchQuery]);

  const handleSelectDiagram = (diagramId: string) => {
    navigate(`/projects/${projectId}/diagrams/${diagramId}`);
    if (closeOnSelect) onClose();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header — IDE style */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{projectEmoji || '📁'}</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider truncate">
            {t('editor.diagramStructure')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNewDiagram(null)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
            aria-label={t('editor.newDiagram')}
            title={t('editor.newDiagram')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={onNewFolder}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
            aria-label={t('editor.newFolder')}
            title={t('editor.newFolder')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('editor.searchDiagrams')}
          className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:ring-1 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      {/* File tree */}
      <div
        className="flex-1 overflow-y-auto py-1 text-xs"
        onDragOver={(e) => onDragOver(e, null)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, null)}
      >
        {/* Project root label */}
        <div className="flex items-center gap-1.5 px-3 py-1 mb-0.5">
          <svg className={`w-3 h-3 text-gray-400 transition-transform rotate-90`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">{projectName}</span>
        </div>

        {/* Root diagrams */}
        {filteredData.diagrams.map(diagram => (
          <div
            key={diagram.id}
            className={`group flex items-center gap-1 mx-1 rounded transition-colors ${
              diagram.id === currentDiagramId
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
            } ${draggedDiagramId === diagram.id ? 'opacity-40' : ''}`}
          >
            <button
              draggable
              onDragStart={() => onDragStart(diagram.id)}
              onClick={() => handleSelectDiagram(diagram.id)}
              className={`flex-1 text-left px-2 py-1.5 flex items-center gap-2 cursor-move min-w-0 ${
                diagram.id === currentDiagramId
                  ? 'text-purple-700 dark:text-purple-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="flex-shrink-0">{DIAGRAM_ICONS[diagram.diagram_type] || '📄'}</span>
              <span className="truncate">{diagram.title}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteDiagram(diagram.id, diagram.title); }}
              className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity mr-0.5"
              aria-label={t('editor.deleteDiagram')}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}

        {/* Folders */}
        {filteredData.folders.map(folder => (
          <div
            key={folder.id}
            onDragOver={(e) => onDragOver(e, folder.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, folder.id)}
          >
            <div className={`flex items-center gap-1 mx-1 rounded transition-colors ${
              dropTargetFolderId === folder.id ? 'bg-purple-100 dark:bg-purple-900/30' : ''
            }`}>
              {editingFolderId === folder.id ? (
                <div className="flex-1 flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => onEditingFolderNameChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSaveFolderEdit(); if (e.key === 'Escape') onCancelFolderEdit(); }}
                    className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={onSaveFolderEdit} className="p-0.5 text-green-600 hover:text-green-700"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                  <button onClick={onCancelFolderEdit} className="p-0.5 text-gray-400 hover:text-gray-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ) : (
                <div className="group flex-1 flex items-center">
                  <button
                    onClick={() => onToggleFolder(folder.id)}
                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors"
                  >
                    <svg className={`w-3 h-3 text-gray-400 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: folder.color }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="truncate font-medium">{folder.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-auto text-[10px]">{folder.diagrams.length}</span>
                  </button>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                    <button onClick={() => onNewDiagram(folder.id)} className="p-0.5 text-gray-400 hover:text-green-600" title={t('editor.newDiagramInFolder')}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button onClick={() => onEditFolder(folder.id, folder.name)} className="p-0.5 text-gray-400 hover:text-purple-600" title={t('editor.editFolder')}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => onDeleteFolder(folder.id, folder.name, folder.diagrams.length)} className="p-0.5 text-gray-400 hover:text-red-500" title={t('editor.deleteFolder')}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Folder children */}
            {expandedFolders.has(folder.id) && (
              <div className="ml-3 border-l border-gray-200 dark:border-gray-700">
                {folder.diagrams.map(diagram => (
                  <div
                    key={diagram.id}
                    className={`group flex items-center gap-1 mx-1 rounded transition-colors ${
                      diagram.id === currentDiagramId
                        ? 'bg-purple-100 dark:bg-purple-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    } ${draggedDiagramId === diagram.id ? 'opacity-40' : ''}`}
                  >
                    <button
                      draggable
                      onDragStart={() => onDragStart(diagram.id)}
                      onClick={() => handleSelectDiagram(diagram.id)}
                      className={`flex-1 text-left px-2 py-1.5 flex items-center gap-2 cursor-move min-w-0 ${
                        diagram.id === currentDiagramId
                          ? 'text-purple-700 dark:text-purple-300 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="flex-shrink-0">{DIAGRAM_ICONS[diagram.diagram_type] || '📄'}</span>
                      <span className="truncate">{diagram.title}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteDiagram(diagram.id, diagram.title); }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity mr-0.5"
                      aria-label={t('editor.deleteDiagram')}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                {folder.diagrams.length === 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 px-3 py-1 italic">{t('editor.noDiagrams')}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {filteredData.diagrams.length === 0 && filteredData.folders.length === 0 && (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
            <p className="text-xs">{searchQuery ? t('editor.noSearchResults') : t('editor.noDiagramsOrFolders')}</p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
        <span>{diagrams.length + folders.reduce((acc, f) => acc + f.diagrams.length, 0)} {t('editor.diagramCount')}</span>
        <span>{folders.length} {t('editor.folderCount')}</span>
      </div>
    </div>
  );
}
