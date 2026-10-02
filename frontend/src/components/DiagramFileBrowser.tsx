import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PinIcon } from './PinIcon';

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
  onRenameDiagram: (id: string, title: string) => void;
  onDuplicateDiagram: (id: string, title: string) => void;
  onMoveDiagramToFolder: (id: string, folderId: string | null) => void;
  onMoveDiagramToProject: (id: string, title: string) => void;
  onDeleteFolder: (id: string, name: string, count: number) => void;
  onEditFolder: (id: string, name: string) => void;
  /** Export the whole project (header action). */
  onExportProject?: () => void;
  /** Export one folder (folder menu). */
  onExportFolder?: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, folderId: string | null) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
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
  /** Desktop only: when provided, renders a pin toggle in the header. */
  isPinned?: boolean;
  onTogglePin?: () => void;
}

/** Compact type badge per diagram engine (format identifiers, not translatable copy). */
const DIAGRAM_BADGES: Record<string, { label: string; name: string; className: string }> = {
  mermaid: { label: 'MMD', name: 'Mermaid', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  plantuml: { label: 'PUML', name: 'PlantUML', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  d2: { label: 'D2', name: 'D2', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  dbml: { label: 'DBML', name: 'DBML', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  freehand: { label: 'DRAW', name: 'Freehand', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
};

const FALLBACK_BADGE = { label: 'TXT', name: '', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };

type MenuTarget =
  | { kind: 'diagram'; id: string; view: 'main' | 'folders' }
  | { kind: 'folder'; id: string };
type MenuState = MenuTarget & { x: number; y: number };

const MENU_WIDTH = 176; // w-44
const menuItemClass =
  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700';
const rowActionClass =
  'p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-600/60 rounded focus:outline-none focus:ring-2 focus:ring-purple-500';

function Icon({ d, className = 'w-3.5 h-3.5' }: { d: string; className?: string }) {
  return (
    <svg className={`${className} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const ICONS = {
  dots: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z',
  rename: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  duplicate: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  project: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus: 'M12 4v16m8-8H4',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 19l-7-7 7-7',
  check: 'M5 13l4 4L19 7',
  close: 'M6 18L18 6M6 6l12 12',
  newFile: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  newFolder: 'M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
};

/**
 * Callback ref for inline rename inputs: focuses and selects the text once on mount.
 * (`autoFocus` + `onFocus` does not reliably select, and the guard avoids re-selecting
 * on every keystroke re-render.)
 */
const focusAndSelect = (el: HTMLInputElement | null) => {
  if (el && document.activeElement !== el) {
    el.focus();
    el.select();
  }
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
  onRenameDiagram,
  onDuplicateDiagram,
  onMoveDiagramToFolder,
  onMoveDiagramToProject,
  onDeleteFolder,
  onEditFolder,
  onExportProject,
  onExportFolder,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
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
  isPinned,
  onTogglePin,
}: DiagramFileBrowserProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingDiagramId, setRenamingDiagramId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const query = searchQuery.toLowerCase().trim();
  const isSearching = query.length > 0;

  const filteredData = useMemo(() => {
    if (!query) return { diagrams, folders };
    const matches = (d: DiagramItem) => d.title.toLowerCase().includes(query);
    const fd = diagrams.filter(matches);
    const ff = folders
      // A folder whose name matches keeps all its diagrams; otherwise only the matching ones.
      .map(f => (f.name.toLowerCase().includes(query) ? f : { ...f, diagrams: f.diagrams.filter(matches) }))
      .filter(f => f.name.toLowerCase().includes(query) || f.diagrams.length > 0);
    return { diagrams: fd, folders: ff };
  }, [diagrams, folders, query]);

  const totalDiagrams = diagrams.length + folders.reduce((acc, f) => acc + f.diagrams.length, 0);
  const shownDiagrams = filteredData.diagrams.length + filteredData.folders.reduce((acc, f) => acc + f.diagrams.length, 0);

  // While searching, every folder with results is shown expanded so matches are never hidden.
  const isFolderOpen = (folderId: string) => isSearching || expandedFolders.has(folderId);

  // --- Keyboard tree navigation (WAI-ARIA tree pattern, roving tabindex) ---
  // Keys: `f:<folderId>` for folders, `d:<diagramId>` for diagrams.
  const treeRef = useRef<HTMLDivElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  /** Visible tree items in DOM order, with the parent folder for diagrams inside one. */
  const visibleItems = useMemo(() => {
    const items: { key: string; parent: string | null }[] = [];
    for (const f of filteredData.folders) {
      items.push({ key: `f:${f.id}`, parent: null });
      if (isSearching || expandedFolders.has(f.id)) {
        for (const d of f.diagrams) items.push({ key: `d:${d.id}`, parent: `f:${f.id}` });
      }
    }
    for (const d of filteredData.diagrams) items.push({ key: `d:${d.id}`, parent: null });
    return items;
  }, [filteredData, isSearching, expandedFolders]);

  const visibleKeys = visibleItems.map(i => i.key);
  // The single Tab stop: last focused item, else the open diagram, else the first item.
  const tabStopKey =
    (activeKey && visibleKeys.includes(activeKey) && activeKey) ||
    (currentDiagramId && visibleKeys.includes(`d:${currentDiagramId}`) && `d:${currentDiagramId}`) ||
    visibleKeys[0];

  const focusTreeItem = (key: string | undefined) => {
    if (!key) return;
    treeRef.current?.querySelector<HTMLElement>(`[data-tree-key="${key}"]`)?.focus();
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const key = (e.target as HTMLElement).dataset.treeKey;
    if (!key) return; // e.g. typing in an inline rename input
    const index = visibleKeys.indexOf(key);
    const item = visibleItems[index];
    const isFolder = key.startsWith('f:');
    const folderId = key.slice(2);

    const handled = (() => {
      switch (e.key) {
        case 'ArrowDown': focusTreeItem(visibleKeys[index + 1]); return true;
        case 'ArrowUp': focusTreeItem(visibleKeys[index - 1]); return true;
        case 'Home': focusTreeItem(visibleKeys[0]); return true;
        case 'End': focusTreeItem(visibleKeys[visibleKeys.length - 1]); return true;
        case 'ArrowRight':
          if (!isFolder) return false;
          if (!isFolderOpen(folderId)) onToggleFolder(folderId);
          else if (visibleItems[index + 1]?.parent === key) focusTreeItem(visibleKeys[index + 1]);
          return true;
        case 'ArrowLeft':
          if (isFolder && isFolderOpen(folderId) && !isSearching) onToggleFolder(folderId);
          else if (item?.parent) focusTreeItem(item.parent);
          return true;
        default:
          // Context-menu key or Shift+F10 opens the row menu from the keyboard.
          if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const target: MenuTarget = isFolder
              ? { kind: 'folder', id: folderId }
              : { kind: 'diagram', id: key.slice(2), view: 'main' };
            setMenu({
              ...target,
              x: Math.min(rect.left + 24, window.innerWidth - MENU_WIDTH - 8),
              y: Math.min(rect.bottom + 4, window.innerHeight - 260),
            });
            return true;
          }
          return false;
      }
    })();
    if (handled) e.preventDefault();
  };

  const findDiagram = (id: string): DiagramItem | undefined =>
    diagrams.find(d => d.id === id) ?? folders.flatMap(f => f.diagrams).find(d => d.id === id);

  /** Folder id holding the diagram, or `null` for the project root. */
  const locationOf = (id: string): string | null =>
    folders.find(f => f.diagrams.some(d => d.id === id))?.id ?? null;

  // Close the context menu on outside click, Escape, scroll or resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  // Focus the first menu item when a menu (or menu view) opens, for keyboard users.
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [menu]);

  const openMenuAt = (e: React.MouseEvent, next: MenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setMenu({ ...next, x, y });
  };

  const openMenuFromButton = (e: React.MouseEvent<HTMLButtonElement>, next: MenuTarget) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8);
    const y = Math.min(rect.bottom + 4, window.innerHeight - 260);
    setMenu({ ...next, x: Math.max(8, x), y });
  };

  const handleSelectDiagram = (diagramId: string) => {
    navigate(`/projects/${projectId}/diagrams/${diagramId}`);
    if (closeOnSelect) onClose();
  };

  const startRename = (diagram: DiagramItem) => {
    setMenu(null);
    setRenamingDiagramId(diagram.id);
    setRenameValue(diagram.title);
  };

  const commitRename = () => {
    if (!renamingDiagramId) return;
    const original = findDiagram(renamingDiagramId);
    const next = renameValue.trim();
    if (original && next && next !== original.title) onRenameDiagram(renamingDiagramId, next);
    setRenamingDiagramId(null);
  };

  // Drag handlers that stop bubbling, so a drop on a folder never also fires the root drop.
  const folderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.stopPropagation();
    onDragOver(e, folderId);
  };
  const folderDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // Ignore leave events fired when moving between children of the same drop zone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    onDragLeave();
  };
  const folderDrop = (e: React.DragEvent, folderId: string | null) => {
    e.stopPropagation();
    onDrop(e, folderId);
  };

  const renderDiagramRow = (diagram: DiagramItem, level: 1 | 2) => {
    const isCurrent = diagram.id === currentDiagramId;
    const badge = DIAGRAM_BADGES[diagram.diagram_type] || FALLBACK_BADGE;
    const menuOpen = menu?.kind === 'diagram' && menu.id === diagram.id;

    if (renamingDiagramId === diagram.id) {
      return (
        <div key={diagram.id} className="flex items-center gap-2 mx-1 px-2 py-1">
          <span className={`flex-shrink-0 w-9 text-center rounded text-[9px] font-bold leading-4 ${badge.className}`}>{badge.label}</span>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenamingDiagramId(null);
            }}
            onBlur={commitRename}
            aria-label={t('fileBrowser.rename')}
            className="flex-1 min-w-0 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            ref={focusAndSelect}
          />
        </div>
      );
    }

    return (
      <div
        key={diagram.id}
        onContextMenu={(e) => openMenuAt(e, { kind: 'diagram', id: diagram.id, view: 'main' })}
        className={`group flex items-center gap-1 mx-1 rounded transition-colors ${
          isCurrent
            ? 'bg-purple-100 dark:bg-purple-900/40'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        } ${draggedDiagramId === diagram.id ? 'opacity-40' : ''}`}
      >
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            // Firefox only starts a drag when some data is set.
            e.dataTransfer.setData('text/plain', diagram.id);
            onDragStart(diagram.id);
          }}
          onDragEnd={onDragEnd}
          onClick={() => handleSelectDiagram(diagram.id)}
          onDoubleClick={() => startRename(diagram)}
          onKeyDown={(e) => { if (e.key === 'F2') { e.preventDefault(); startRename(diagram); } }}
          title={diagram.title}
          role="treeitem"
          aria-level={level}
          aria-selected={isCurrent}
          aria-current={isCurrent ? 'page' : undefined}
          data-tree-key={`d:${diagram.id}`}
          tabIndex={tabStopKey === `d:${diagram.id}` ? 0 : -1}
          onFocus={() => setActiveKey(`d:${diagram.id}`)}
          className={`flex-1 text-left px-2 py-1.5 flex items-center gap-2 min-w-0 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            isCurrent
              ? 'text-purple-700 dark:text-purple-300 font-medium'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          <span
            className={`flex-shrink-0 w-9 text-center rounded text-[9px] font-bold leading-4 ${badge.className}`}
            title={badge.name}
          >
            {badge.label}
          </span>
          <span className="truncate">{diagram.title}</span>
        </button>

        <button
          onClick={(e) => openMenuFromButton(e, { kind: 'diagram', id: diagram.id, view: 'main' })}
          className={`${rowActionClass} mr-0.5 transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
          aria-label={t('fileBrowser.actionsFor', { name: diagram.title })}
          tabIndex={-1}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Icon d={ICONS.dots} />
        </button>
      </div>
    );
  };

  const renderMenu = () => {
    if (!menu) return null;

    let content: React.ReactNode = null;

    if (menu.kind === 'diagram') {
      const diagram = findDiagram(menu.id);
      if (!diagram) return null;
      const currentFolderId = locationOf(diagram.id);

      if (menu.view === 'folders') {
        const targets: { id: string | null; name: string; color?: string }[] = [
          { id: null, name: t('fileBrowser.projectRoot') },
          ...folders.map(f => ({ id: f.id, name: f.name, color: f.color })),
        ];
        content = (
          <>
            <button className={`${menuItemClass} font-medium`} onClick={() => setMenu({ ...menu, view: 'main' })}>
              <Icon d={ICONS.back} />
              {t('fileBrowser.moveToFolder')}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <div className="max-h-56 overflow-y-auto">
              {targets.map(target => {
                const isHere = target.id === currentFolderId;
                return (
                  <button
                    key={target.id ?? 'root'}
                    role="menuitem"
                    disabled={isHere}
                    className={`${menuItemClass} disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent`}
                    onClick={() => {
                      setMenu(null);
                      onMoveDiagramToFolder(diagram.id, target.id);
                    }}
                  >
                    {target.id ? (
                      // Folder colors are user-picked hex values, so they can't be Tailwind classes.
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: target.color }} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS.folder} />
                      </svg>
                    ) : (
                      <span className="w-3.5 text-center flex-shrink-0">{projectEmoji || '📁'}</span>
                    )}
                    <span className="truncate">{target.name}</span>
                    {isHere && <Icon d={ICONS.check} className="w-3.5 h-3.5 ml-auto text-purple-600 dark:text-purple-400" />}
                  </button>
                );
              })}
            </div>
          </>
        );
      } else {
        content = (
          <>
            <button role="menuitem" className={menuItemClass} onClick={() => startRename(diagram)}>
              <Icon d={ICONS.rename} />
              {t('fileBrowser.rename')}
              <span className="text-[10px] ml-auto text-gray-400">F2</span>
            </button>
            <button role="menuitem" className={menuItemClass} onClick={() => { setMenu(null); onDuplicateDiagram(diagram.id, diagram.title); }}>
              <Icon d={ICONS.duplicate} />
              {t('fileBrowser.duplicate')}
            </button>
            <button role="menuitem" className={menuItemClass} onClick={() => setMenu({ ...menu, view: 'folders' })}>
              <Icon d={ICONS.folder} />
              {t('fileBrowser.moveToFolder')}
              <Icon d={ICONS.chevron} className="w-3 h-3 ml-auto text-gray-400" />
            </button>
            <button role="menuitem" className={menuItemClass} onClick={() => { setMenu(null); onMoveDiagramToProject(diagram.id, diagram.title); }}>
              <Icon d={ICONS.project} />
              {t('fileBrowser.moveToProject')}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              role="menuitem"
              className={`${menuItemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
              onClick={() => { setMenu(null); onDeleteDiagram(diagram.id, diagram.title); }}
            >
              <Icon d={ICONS.trash} />
              {t('fileBrowser.delete')}
            </button>
          </>
        );
      }
    } else {
      const folder = folders.find(f => f.id === menu.id);
      if (!folder) return null;
      content = (
        <>
          <button role="menuitem" className={menuItemClass} onClick={() => { setMenu(null); onNewDiagram(folder.id); }}>
            <Icon d={ICONS.plus} />
            {t('fileBrowser.newDiagramHere')}
          </button>
          <button role="menuitem" className={menuItemClass} onClick={() => { setMenu(null); onEditFolder(folder.id, folder.name); }}>
            <Icon d={ICONS.rename} />
            {t('fileBrowser.rename')}
          </button>
          {onExportFolder && (
            <button role="menuitem" className={menuItemClass} onClick={() => { setMenu(null); onExportFolder(folder.id); }}>
              <Icon d={ICONS.download} />
              {t('projectExport.exportFolder')}
            </button>
          )}
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          <button
            role="menuitem"
            className={`${menuItemClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
            onClick={() => { setMenu(null); onDeleteFolder(folder.id, folder.name, folder.diagrams.length); }}
          >
            <Icon d={ICONS.trash} />
            {t('fileBrowser.delete')}
          </button>
        </>
      );
    }

    return (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-50 w-44 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
        style={{ left: menu.x, top: menu.y }}
      >
        {content}
      </div>
    );
  };

  const hasContent = filteredData.diagrams.length > 0 || filteredData.folders.length > 0;
  const showRootDropZone = !!draggedDiagramId && locationOf(draggedDiagramId) !== null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header — project identity + actions */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0" title={projectName}>
          <span className="text-sm flex-shrink-0">{projectEmoji || '📁'}</span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{projectName}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onNewDiagram(null)} className={rowActionClass} aria-label={t('editor.newDiagram')} title={t('editor.newDiagram')}>
            <Icon d={ICONS.newFile} className="w-4 h-4" />
          </button>
          <button onClick={onNewFolder} className={rowActionClass} aria-label={t('editor.newFolder')} title={t('editor.newFolder')}>
            <Icon d={ICONS.newFolder} className="w-4 h-4" />
          </button>
          {onExportProject && (
            <button onClick={onExportProject} className={rowActionClass} aria-label={t('projectExport.exportProject')} title={t('projectExport.exportProject')}>
              <Icon d={ICONS.download} className="w-4 h-4" />
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isPinned
                  ? 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              aria-label={isPinned ? t('editor.unpinPanel') : t('editor.pinPanel')}
              aria-pressed={!!isPinned}
              title={isPinned ? t('editor.unpinPanel') : t('editor.pinPanel')}
            >
              <PinIcon pinned={!!isPinned} />
            </button>
          )}
          <button onClick={onClose} className={rowActionClass} aria-label={t('common.close')} title={t('common.close')}>
            <Icon d={ICONS.close} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-2 flex items-center text-gray-400 dark:text-gray-500 pointer-events-none">
            <Icon d={ICONS.search} className="w-3 h-3" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && searchQuery) { e.stopPropagation(); setSearchQuery(''); } }}
            placeholder={t('editor.searchDiagrams')}
            aria-label={t('editor.searchDiagrams')}
            className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded pl-6 pr-6 py-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-1 flex items-center px-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={t('fileBrowser.clearSearch')}
            >
              <Icon d={ICONS.close} className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* File tree — the whole area is the project-root drop zone */}
      <div
        ref={treeRef}
        role="tree"
        aria-label={projectName}
        onKeyDown={handleTreeKeyDown}
        className="flex-1 overflow-y-auto py-1 text-xs"
        onDragOver={(e) => onDragOver(e, null)}
        onDragLeave={folderDragLeave}
        onDrop={(e) => onDrop(e, null)}
      >
        {showRootDropZone && (
          <div
            onDragOver={(e) => folderDragOver(e, null)}
            onDrop={(e) => folderDrop(e, null)}
            className="mx-2 mb-1 px-2 py-2 border border-dashed border-purple-300 dark:border-purple-700 rounded text-[10px] text-center text-purple-600 dark:text-purple-300 bg-purple-50/60 dark:bg-purple-900/20"
          >
            {t('fileBrowser.dropToRoot')}
          </div>
        )}

        {/* Folders first, like any file explorer */}
        {filteredData.folders.map(folder => {
          const open = isFolderOpen(folder.id);
          const menuOpen = menu?.kind === 'folder' && menu.id === folder.id;
          const isDropTarget = dropTargetFolderId === folder.id && !!draggedDiagramId;
          return (
            <div
              key={folder.id}
              onDragOver={(e) => folderDragOver(e, folder.id)}
              onDragLeave={folderDragLeave}
              onDrop={(e) => folderDrop(e, folder.id)}
              className={`rounded mx-1 transition-colors ${isDropTarget ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-400 dark:ring-purple-600' : ''}`}
            >
              {editingFolderId === folder.id ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => onEditingFolderNameChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSaveFolderEdit(); if (e.key === 'Escape') onCancelFolderEdit(); }}
                    aria-label={t('fileBrowser.rename')}
                    className="flex-1 min-w-0 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    ref={focusAndSelect}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={onSaveFolderEdit} className="p-1 text-green-600 hover:text-green-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" aria-label={t('common.save')}>
                    <Icon d={ICONS.check} />
                  </button>
                  <button onClick={onCancelFolderEdit} className="p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500" aria-label={t('common.cancel')}>
                    <Icon d={ICONS.close} />
                  </button>
                </div>
              ) : (
                <div
                  className="group flex items-center rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  onContextMenu={(e) => openMenuAt(e, { kind: 'folder', id: folder.id })}
                >
                  <button
                    onClick={() => onToggleFolder(folder.id)}
                    onDoubleClick={() => onEditFolder(folder.id, folder.name)}
                    onKeyDown={(e) => { if (e.key === 'F2') { e.preventDefault(); onEditFolder(folder.id, folder.name); } }}
                    aria-expanded={open}
                    title={folder.name}
                    role="treeitem"
                    aria-level={1}
                    aria-selected={false}
                    data-tree-key={`f:${folder.id}`}
                    tabIndex={tabStopKey === `f:${folder.id}` ? 0 : -1}
                    onFocus={() => setActiveKey(`f:${folder.id}`)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-gray-700 dark:text-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <Icon d={ICONS.chevron} className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                    {/* Folder colors are user-picked hex values, so they can't be Tailwind classes. */}
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: folder.color }} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS.folder} />
                    </svg>
                    <span className="truncate font-medium">{folder.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-auto pl-1 text-[10px]">{folder.diagrams.length}</span>
                  </button>
                  <div className={`flex items-center pr-0.5 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                    <button
                      onClick={() => onNewDiagram(folder.id)}
                      className={rowActionClass}
                      tabIndex={-1}
                      aria-label={t('editor.newDiagramInFolder')}
                      title={t('editor.newDiagramInFolder')}
                    >
                      <Icon d={ICONS.plus} />
                    </button>
                    <button
                      onClick={(e) => openMenuFromButton(e, { kind: 'folder', id: folder.id })}
                      className={rowActionClass}
                      aria-label={t('fileBrowser.actionsFor', { name: folder.name })}
                      tabIndex={-1}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      <Icon d={ICONS.dots} />
                    </button>
                  </div>
                </div>
              )}

              {/* Folder children */}
              {open && (
                <div role="group" className="ml-3 border-l border-gray-200 dark:border-gray-700">
                  {folder.diagrams.map(d => renderDiagramRow(d, 2))}
                  {folder.diagrams.length === 0 && (
                    <button
                      onClick={() => onNewDiagram(folder.id)}
                      className="mx-1 px-2 py-1 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <Icon d={ICONS.plus} className="w-3 h-3" />
                      {t('fileBrowser.newDiagramHere')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root diagrams */}
        {filteredData.diagrams.map(d => renderDiagramRow(d, 1))}

        {/* Empty state */}
        {!hasContent && (
          <div className="text-center py-6 px-3 text-gray-400 dark:text-gray-500">
            <p className="text-xs">{isSearching ? t('editor.noSearchResults') : t('editor.noDiagramsOrFolders')}</p>
            {!isSearching && (
              <button
                onClick={() => onNewDiagram(null)}
                className="mt-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
              >
                {t('editor.newDiagram')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
        <span>
          {isSearching
            ? t('fileBrowser.filteredCount', { shown: shownDiagrams, total: totalDiagrams })
            : `${totalDiagrams} ${t('editor.diagramCount')}`}
        </span>
        <span>{folders.length} {t('editor.folderCount')}</span>
      </div>

      {renderMenu()}
    </div>
  );
}
