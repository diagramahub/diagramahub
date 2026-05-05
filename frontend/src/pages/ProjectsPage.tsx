import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Project } from '../types/project';
import CreateProjectModal from '../components/CreateProjectModal';
import ConfirmModal from '../components/ConfirmModal';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string;
  }>({
    isOpen: false,
    projectId: null,
    projectName: '',
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

  const handleProjectCreated = (projectId: string) => {
    loadProjects();
    navigate(`/projects/${projectId}`);
  };

  const handleProjectUpdated = () => {
    loadProjects();
  };

  const handleEditProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditModal({ isOpen: true, project });
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    setDeleteConfirmModal({ isOpen: true, projectId, projectName });
  };

  const confirmDeleteProject = async () => {
    if (!deleteConfirmModal.projectId) return;
    try {
      await api.deleteProject(deleteConfirmModal.projectId);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('dashboard.title')}
            </h1>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t('dashboard.createProject')}</span>
            <span className="sm:hidden">{t('common.create')}</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            {t('dashboard.loading')}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{t('dashboard.noProjects')}</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              {t('dashboard.createFirstProject')}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-12"></th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      {t('common.name')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {t('project.description')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-center">
                      {t('dashboard.diagrams')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {t('dashboard.lastModified')}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-xl">{project.emoji}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {project.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-500 dark:text-gray-400 truncate block max-w-xs">
                          {project.description
                            ? project.description.length > 60
                              ? project.description.slice(0, 60) + '…'
                              : project.description
                            : <span className="italic text-gray-400 dark:text-gray-500">{t('dashboard.noDescription')}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {project.diagram_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(project.updated_at || project.created_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleEditProject(e, project)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                            aria-label={t('dashboard.editProject')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            aria-label={t('dashboard.deleteProject')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        title={t('dashboard.confirmDelete')}
        message={t('dashboard.deleteProjectMessage', { projectName: deleteConfirmModal.projectName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  );
};

export default ProjectsPage;
