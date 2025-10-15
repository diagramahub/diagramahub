import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  showBackToDashboard?: boolean;
  diagramTitle?: string;
  diagramType?: string;
  onDiagramTitleEdit?: (newTitle: string) => void;
}

export default function Navbar({ showBackToDashboard = false, diagramTitle, diagramType, onDiagramTitleEdit }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(diagramTitle || '');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleTitleEdit = () => {
    if (onDiagramTitleEdit && editTitle.trim()) {
      onDiagramTitleEdit(editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleEdit();
    } else if (e.key === 'Escape') {
      setEditTitle(diagramTitle || '');
      setIsEditingTitle(false);
    }
  };

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="px-4">
        <div className="flex justify-between items-center h-14">
          {/* Logo and Diagram Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleDashboard}
              className="text-lg font-bold text-gray-900 hover:text-gray-600 transition-colors"
            >
              DiagramaHub
            </button>

            {/* Diagram Info */}
            {diagramTitle && (
              <div className="flex items-center gap-2">
                <div className="h-6 w-px bg-gray-300"></div>
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleEdit}
                    onKeyDown={handleTitleKeyPress}
                    className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditTitle(diagramTitle);
                      setIsEditingTitle(true);
                    }}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2"
                  >
                    <span>{diagramTitle}</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {diagramType && (
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${diagramType === 'plantuml'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>
                    {diagramType === 'plantuml' ? '🌱 PlantUML' : '🧜‍♀️ Mermaid'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right side - iconos minimalistas */}
          <div className="flex items-center gap-4">
            {showBackToDashboard && (
              <button
                onClick={handleDashboard}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                title="Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
            )}

            <span className="text-sm text-gray-700 font-medium">
              {user?.full_name || user?.email?.split('@')[0]}
            </span>

            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
