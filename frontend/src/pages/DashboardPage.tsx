import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Project } from '../types/project';
import MfaBanner from '../components/MfaBanner';

/** SVG Donut Chart for diagram type distribution */
function DonutChart({ typeCounts }: { typeCounts: Record<string, number> }) {
  const { t } = useTranslation();

  const colorMap: Record<string, string> = {
    mermaid: '#10b981',
    plantuml: '#22c55e',
    d2: '#6366f1',
    dbml: '#f97316',
  };

  const labelMap: Record<string, string> = {
    mermaid: 'Mermaid',
    plantuml: 'PlantUML',
    d2: 'D2',
    dbml: 'DBML',
  };

  const entries = Object.entries(typeCounts).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        {t('dashboard.noProjects')}
      </div>
    );
  }

  // Build SVG arcs
  const radius = 40;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = entries.map(([type, count]) => {
    const pct = count / total;
    const dashLength = pct * circumference;
    const dashOffset = -offset;
    offset += dashLength;
    return { type, count, pct, dashLength, dashOffset, color: colorMap[type] || '#9ca3af' };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut SVG */}
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {segments.map((seg) => (
            <circle
              key={seg.type}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
              strokeDashoffset={seg.dashOffset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.statsDiagrams')}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-1.5 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-700 dark:text-gray-300">{labelMap[seg.type] || seg.type}</span>
            <span className="text-gray-400 dark:text-gray-500 font-medium">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerStats, setProviderStats] = useState<{ provider_counts: Record<string, number>; total_messages: number } | null>(null);

  useEffect(() => {
    loadProjects();
    loadProviderStats();
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

  const loadProviderStats = async () => {
    try {
      const stats = await api.getProviderUsageStats();
      setProviderStats(stats);
    } catch (error) {
      console.error('Error loading provider stats:', error);
    }
  };

  // Aggregate diagram type counts across all projects
  const typeCounts: Record<string, number> = {};
  projects.forEach((p) => {
    if (p.diagram_type_counts) {
      Object.entries(p.diagram_type_counts).forEach(([type, count]) => {
        typeCounts[type] = (typeCounts[type] || 0) + count;
      });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <MfaBanner />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Welcome */}
        <div className="mb-8 sm:mb-10">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('dashboard.welcome', { name: user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '' })} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.welcomeSubtitle')}</p>
          </div>

          {/* Stats cards */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{projects.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.statsProjects')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{projects.reduce((sum, p) => sum + (p.diagram_count || 0), 0)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.statsDiagrams')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {projects.length > 0
                        ? new Date(Math.max(...projects.map(p => new Date(p.updated_at || p.created_at).getTime()))).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.statsLastActivity')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user?.subscription?.plan?.name || 'Free'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.statsPlan')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Widgets grid: AI Usage (left) + Donut Chart (right) */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Provider Usage Widget */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                {t('dashboard.aiUsage')}
              </h2>
              {providerStats && providerStats.total_messages > 0 ? (
                <div className="space-y-4">
                  {Object.entries(providerStats.provider_counts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([provider, count]) => {
                      const pct = Math.round((count / providerStats.total_messages) * 100);
                      const providerColors: Record<string, string> = {
                        deepseek: 'bg-blue-500',
                        openai: 'bg-emerald-500',
                        gemini: 'bg-sky-500',
                        claude: 'bg-orange-500',
                        minimax: 'bg-pink-500',
                      };
                      const providerNames: Record<string, string> = {
                        deepseek: 'DeepSeek',
                        openai: 'OpenAI GPT',
                        gemini: 'Google Gemini',
                        claude: 'Anthropic Claude',
                        minimax: 'Minimax',
                      };
                      const barColor = providerColors[provider] || 'bg-gray-500';
                      const displayName = providerNames[provider] || provider;

                      return (
                        <div key={provider} className="flex items-center gap-3">
                          <img
                            src={`/images/ai-providers/${provider}.svg`}
                            alt={displayName}
                            className="w-7 h-7 object-contain flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{displayName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{count} · {pct}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
                    {providerStats.total_messages} {t('dashboard.totalAiMessages')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  {t('dashboard.noAiUsage')}
                </div>
              )}
            </div>

            {/* Donut chart widget */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                {t('dashboard.statsDiagrams')}
              </h2>
              <DonutChart typeCounts={typeCounts} />
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">{t('dashboard.loading')}</div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
