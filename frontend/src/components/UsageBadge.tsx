import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { UsageSummary } from '../types/subscription';

export default function UsageBadge() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const data = await apiService.getUsageSummary();
      setUsage(data);
    } catch (err) {
      console.error('Error loading usage:', err);
    }
  };

  if (!usage) return null;

  const isNearLimit = usage.projects.percentage >= 80 || usage.diagrams.percentage >= 80;
  const isAtLimit = usage.projects.percentage >= 100 || usage.diagrams.percentage >= 100;

  const getBadgeColor = () => {
    if (isAtLimit) return 'bg-red-100 text-red-700 border-red-200';
    if (isNearLimit) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null || limit === -1) return '∞';
    return limit.toString();
  };

  return (
    <button
      onClick={() => navigate('/profile?tab=subscription')}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80 ${getBadgeColor()}`}
      title="View subscription details"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span>
        {usage.projects.current}/{formatLimit(usage.projects.limit)} · {usage.diagrams.current}/{formatLimit(usage.diagrams.limit)}
      </span>
    </button>
  );
}
