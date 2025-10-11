import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('Mi primer proyecto');
  const [projectDescription, setProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('El nombre del proyecto es requerido');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create the first project
      const project = await api.createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      });

      // Redirect to the diagram editor for this project
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.response?.data?.detail || 'Error al crear el proyecto. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">¡Bienvenido a DiagramaHub! 👋</h1>
          <p className="text-lg text-gray-600">Comencemos creando tu primer proyecto</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div>
              <label htmlFor="project-name" className="block text-sm font-semibold text-gray-900 mb-2">
                Nombre del proyecto <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                placeholder="Ej: Mi primer proyecto"
                required
                maxLength={100}
              />
              <p className="mt-2 text-sm text-gray-500">Dale un nombre descriptivo a tu proyecto</p>
            </div>

            {/* Project Description */}
            <div>
              <label htmlFor="project-description" className="block text-sm font-semibold text-gray-900 mb-2">
                Descripción (opcional)
              </label>
              <textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Describe brevemente de qué trata tu proyecto..."
                maxLength={500}
              />
              <p className="mt-2 text-sm text-gray-500">
                {projectDescription.length}/500 caracteres
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    <strong>¿Qué sigue?</strong> Después de crear tu proyecto, podrás empezar a crear diagramas usando la sintaxis de Mermaid.
                    Es fácil y visual. ¡No te preocupes, te ayudaremos en el camino!
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !projectName.trim()}
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creando proyecto...
                </span>
              ) : (
                'Crear proyecto y continuar →'
              )}
            </button>
          </form>
        </div>

          {/* Footer Note */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Podrás crear más proyectos después desde tu dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
