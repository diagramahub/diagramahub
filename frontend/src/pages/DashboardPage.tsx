import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Project } from '../types/project';
import Navbar from '../components/Navbar';
import CreateProjectModal from '../components/CreateProjectModal';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateProject = () => {
    setIsCreateModalOpen(true);
  };

  const handleProjectCreated = (projectId: string) => {
    loadProjects();
    navigate(`/projects/${projectId}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error al eliminar el proyecto. Por favor intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Tus proyectos
            </h1>
            <p className="text-gray-600">
              {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'}
            </p>
          </div>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo proyecto
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando proyectos...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No tienes proyectos aún</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="text-sm text-gray-900 hover:text-gray-600 underline"
            >
              Crear tu primer proyecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                className="relative p-6 bg-white border border-gray-100 hover:border-gray-300 transition-colors group"
              >
                <button
                  onClick={() => handleProjectClick(project.id)}
                  className="text-left w-full"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-3xl">{project.emoji}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 ml-12">
                    {new Date(project.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar proyecto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleProjectCreated}
        isFirstProject={false}
      />
    </div>
  );
};

export default DashboardPage;
