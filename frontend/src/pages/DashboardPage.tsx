import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Project } from '../types/project';
import Navbar from '../components/Navbar';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Tus proyectos
          </h1>
          <p className="text-gray-600">
            {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'}
          </p>
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
              <button
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="text-left p-6 bg-white border border-gray-100 hover:border-gray-300 transition-colors group"
              >
                <h3 className="font-medium text-gray-900 mb-2 group-hover:text-gray-600 transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-3">{project.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(project.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
