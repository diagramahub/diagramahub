import { useState } from 'react';
import { ChatSession } from '../types/chat';

interface ChatSessionSelectorProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

export default function ChatSessionSelector({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
}: ChatSessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleStartRename = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleConfirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors min-w-0"
        >
          <span className="truncate flex-1 text-gray-700 dark:text-gray-300 font-medium">
            {activeSession?.title || 'Seleccionar sesión'}
          </span>
          {activeSession?.status === 'finalized' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-full flex-shrink-0">
              finalizada
            </span>
          )}
          <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onCreateSession}
          className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/50 rounded-lg transition-colors flex-shrink-0"
          title="Nueva sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">Sin sesiones</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                  session.id === activeSessionId ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                }`}
              >
                {editingId === session.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleConfirmRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 text-xs px-1 py-0.5 border border-purple-300 dark:border-purple-600 rounded focus:ring-1 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { onSelectSession(session.id); setIsOpen(false); }}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{session.title}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {session.message_count} msgs
                        {session.status === 'finalized' && ' • finalizada'}
                      </span>
                    </button>
                    {session.status === 'active' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleStartRename(session); }}
                        className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Renombrar"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
