import { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { UsageSummary } from '../../types/subscription';

export default function UsageIndicator() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUsageSummary();
      setUsage(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading usage');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-100';
    if (percentage >= 80) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null || limit === -1) return 'Unlimited';
    return limit.toString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const getPercentage = (current: number, limit: number | null) => {
    if (!limit || limit === -1 || limit === 0) return 0;
    return (current / limit) * 100;
  };

  const projPercentage = getPercentage(usage.projects.current, usage.projects.limit);
  const diagPercentage = getPercentage(usage.diagrams.current, usage.diagrams.limit);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Resource Usage</h2>
        <p className="mt-1 text-sm text-gray-600">Track your current usage against plan limits</p>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Projects Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Projects</span>
            <span className="text-sm text-gray-600">
              {usage.projects.current} / {formatLimit(usage.projects.limit)}
            </span>
          </div>
          <div className={`w-full h-2 rounded-full ${getProgressBarColor(projPercentage)}`}>
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(projPercentage)}`}
              style={{ width: `${Math.min(projPercentage, 100)}%` }}
            />
          </div>
          {projPercentage >= 80 && (
            <p className="mt-2 text-xs text-yellow-600">
              {projPercentage >= 100
                ? 'You have reached your project limit. Upgrade to create more projects.'
                : 'You are approaching your project limit.'}
            </p>
          )}
        </div>

        {/* Diagrams Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Diagrams</span>
            <span className="text-sm text-gray-600">
              {usage.diagrams.current} / {formatLimit(usage.diagrams.limit)}
            </span>
          </div>
          <div className={`w-full h-2 rounded-full ${getProgressBarColor(diagPercentage)}`}>
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(diagPercentage)}`}
              style={{ width: `${Math.min(diagPercentage, 100)}%` }}
            />
          </div>
          {diagPercentage >= 80 && (
            <p className="mt-2 text-xs text-yellow-600">
              {diagPercentage >= 100
                ? 'You have reached your diagram limit. Upgrade to create more diagrams.'
                : 'You are approaching your diagram limit.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
