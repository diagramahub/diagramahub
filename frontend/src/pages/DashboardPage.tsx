import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Project } from '../types/project';
import Navbar from '../components/Navbar';
import CreateProjectModal from '../components/CreateProjectModal';
import ConfirmModal from '../components/ConfirmModal';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; projectId: string | null; projectName: string }>({
    isOpen: false,
    projectId: null,
    projectName: ''
  });

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

  const handleEditProject = (project: Project) => {
    setEditModal({
      isOpen: true,
      project
    });
  };

  const handleProjectUpdated = () => {
    loadProjects();
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      projectId,
      projectName
    });
  };

  const confirmDeleteProject = async () => {
    if (!deleteConfirmModal.projectId) return;

    try {
      await api.deleteProject(deleteConfirmModal.projectId);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      // Puedes agregar un toast o notificación aquí en lugar de alert
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 transition-colors">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div
                key={project.id}
                className="relative bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => handleProjectClick(project.id)}
              >
                {/* Header with emoji and name */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-2xl">
                      {project.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                        {project.name}
                      </h3>
                      {project.description ? (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mt-1">Sin descripción</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats section */}
                <div className="px-5 py-3 bg-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{project.diagram_count}</span>
                      <span className="text-gray-500">{project.diagram_count === 1 ? 'diagrama' : 'diagramas'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(project.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Editar proyecto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id, project.name);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar proyecto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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

      {/* Edit Project Modal */}
      <CreateProjectModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, project: null })}
        onSuccess={handleProjectUpdated}
        editMode={true}
        projectToEdit={editModal.project || undefined}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, projectId: null, projectName: '' })}
        onConfirm={confirmDeleteProject}
        title="Eliminar proyecto"
        message={`¿Estás seguro de que quieres eliminar el proyecto "${deleteConfirmModal.projectName}"? Esta acción no se puede deshacer y se eliminarán todos los diagramas y carpetas asociados.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
      />
    </div>
  );
};

export default DashboardPage;
