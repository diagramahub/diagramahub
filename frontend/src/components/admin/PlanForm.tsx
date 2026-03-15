import { useState } from 'react';
import apiService from '../../services/api';
import { Plan, PlanCreate, PlanUpdate } from '../../types/subscription';

interface PlanFormProps {
  plan: Plan | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlanForm({ plan, onClose, onSuccess }: PlanFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [priceUsd, setPriceUsd] = useState(plan?.price_usd?.toString() || '0');
  const [maxProjects, setMaxProjects] = useState(plan?.max_projects?.toString() || '');
  const [maxDiagrams, setMaxDiagrams] = useState(plan?.max_diagrams?.toString() || '');
  const [unlimitedProjects, setUnlimitedProjects] = useState(plan?.max_projects === null || plan?.max_projects === -1);
  const [unlimitedDiagrams, setUnlimitedDiagrams] = useState(plan?.max_diagrams === null || plan?.max_diagrams === -1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!name.trim()) {
      setError('Plan name is required');
      return;
    }

    const price = parseFloat(priceUsd);
    if (isNaN(price) || price < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }

    let projects: number | null = null;
    if (!unlimitedProjects) {
      projects = parseInt(maxProjects);
      if (isNaN(projects) || projects < 0) {
        setError('Max projects must be a valid non-negative number');
        return;
      }
    }

    let diagrams: number | null = null;
    if (!unlimitedDiagrams) {
      diagrams = parseInt(maxDiagrams);
      if (isNaN(diagrams) || diagrams < 0) {
        setError('Max diagrams must be a valid non-negative number');
        return;
      }
    }

    setLoading(true);

    try {
      if (plan) {
        // Update existing plan
        const updateData: PlanUpdate = {
          name: name.trim(),
          description: description.trim() || undefined,
          price_usd: price,
          max_projects: projects,
          max_diagrams: diagrams,
        };
        await apiService.updatePlan(plan.id, updateData);
      } else {
        // Create new plan
        const createData: PlanCreate = {
          name: name.trim(),
          description: description.trim() || undefined,
          price_usd: price,
          max_projects: projects,
          max_diagrams: diagrams,
        };
        await apiService.createPlan(createData);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Error ${plan ? 'updating' : 'creating'} plan`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Plan Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Plan Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Pro, Enterprise"
              disabled={plan?.is_free}
            />
            {plan?.is_free && (
              <p className="mt-1 text-xs text-gray-500">FREE plan name cannot be changed</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the plan features"
            />
          </div>

          {/* Price */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Price (USD/month) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Max Projects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Projects *
            </label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={unlimitedProjects}
                  onChange={(e) => setUnlimitedProjects(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Unlimited</span>
              </label>
            </div>
            {!unlimitedProjects && (
              <input
                type="number"
                min="0"
                value={maxProjects}
                onChange={(e) => setMaxProjects(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 10"
              />
            )}
          </div>

          {/* Max Diagrams */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Diagrams *
            </label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={unlimitedDiagrams}
                  onChange={(e) => setUnlimitedDiagrams(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Unlimited</span>
              </label>
            </div>
            {!unlimitedDiagrams && (
              <input
                type="number"
                min="0"
                value={maxDiagrams}
                onChange={(e) => setMaxDiagrams(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 100"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
