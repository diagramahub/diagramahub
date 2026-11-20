import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { PublicBadge } from '../components/community/PublicBadge';
import { usePublishedDiagrams } from '../hooks/usePublishedDiagrams';
import { Project } from '../types/project';
import MfaBanner from '../components/MfaBanner';
import { DashboardStatsSkeleton, DashboardWidgetsSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import type { UsageSummary } from '../types/subscription';
import { dateLocale } from '../utils/locale';
import { browserTimeZone } from '../utils/activityHeatmap';
import type { ActivityHeatmap as Heatmap, CommunityImpact, DiagramListEntry, FavoriteDiagrams } from '../types/dashboard';
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { CommunityImpactCard } from '../components/dashboard/CommunityImpactCard';
import { FavoriteDiagramsTable } from '../components/dashboard/FavoriteDiagramsTable';

const FAVORITES_SHOWN = 10;

/** SVG Donut Chart for diagram type distribution */
function DonutChart({ typeCounts }: { typeCounts: Record<string, number> }) {
  const { t } = useTranslation();

  const colorMap: Record<string, string> = {
    mermaid: '#10b981',
    plantuml: '#0ea5e9',
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

const STAT_TONES = {
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
};

interface StatCardProps {
  value: string;
  label: string;
  iconPath: string;
  tone: keyof typeof STAT_TONES;
  /** Makes the whole card a link. */
  to?: string;
  linkLabel?: string;
}

/** One number of the summary row; a link when it leads somewhere. */
function StatCard({ value, label, iconPath, tone, to, linkLabel }: StatCardProps) {
  const body = (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${STAT_TONES[tone]}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
      </div>
      {to && (
        <svg className="w-4 h-4 flex-shrink-0 text-gray-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
  const base = 'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4';
  return to ? (
    <Link
      to={to}
      title={linkLabel}
      aria-label={linkLabel ? `${value} ${label}. ${linkLabel}` : undefined}
      className={`${base} group block transition-colors hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/40 dark:hover:bg-purple-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerStats, setProviderStats] = useState<{ provider_counts: Record<string, number>; total_messages: number } | null>(null);
  const { published } = usePublishedDiagrams();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [recentDiagrams, setRecentDiagrams] = useState<Array<{ id: string; title: string; diagram_type: string; project_id: string; project_name: string; project_emoji: string; updated_at: string }>>([]);

  const [activity, setActivity] = useState<Heatmap | null>(null);
  const [activityError, setActivityError] = useState(false);
  const [impact, setImpact] = useState<CommunityImpact | null>(null);
  const [favorites, setFavorites] = useState<FavoriteDiagrams | null>(null);

  const loadFavorites = () =>
    api.getFavoriteDiagrams(FAVORITES_SHOWN).then(setFavorites).catch(() => setFavorites({ items: [], total: 0 }));

  useEffect(() => {
    loadProjects();
    loadProviderStats();
    loadRecentDiagrams();
    api.getUsageSummary().then(setUsage).catch(() => setUsage(null));
    api.getActivityHeatmap(84, browserTimeZone()).then(setActivity).catch(() => setActivityError(true));
    api.getCommunityImpact().then(setImpact).catch(() => setImpact(null));
    loadFavorites();
  }, []);

  const unstar = async (diagram: DiagramListEntry) => {
    try {
      await api.setDiagramFavorite(diagram.id, false);
      setFavorites((prev) =>
        prev ? { items: prev.items.filter((d) => d.id !== diagram.id), total: Math.max(0, prev.total - 1) } : prev,
      );
      // A favorite beyond the first page may now fit in.
      if (favorites && favorites.total > favorites.items.length) loadFavorites();
      return true;
    } catch {
      return false;
    }
  };

  const restar = async (diagram: DiagramListEntry) => {
    try {
      await api.setDiagramFavorite(diagram.id, true);
      await loadFavorites();
      return true;
    } catch {
      return false;
    }
  };

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

  const loadRecentDiagrams = async () => {
    try {
      const data = await api.getRecentDiagrams();
      setRecentDiagrams(data);
    } catch (error) {
      console.error('Error loading recent diagrams:', error);
    }
  };

  const totalDiagrams = projects.reduce((sum, p) => sum + (p.diagram_count || 0), 0);
  // Editing a diagram doesn't touch its project's date: the latest diagram is the latest activity.
  const lastDiagram = recentDiagrams[0];
  const activityTimes = [
    ...projects.map((p) => new Date(p.updated_at || p.created_at).getTime()),
    ...(lastDiagram ? [new Date(lastDiagram.updated_at).getTime()] : []),
  ].filter((time) => !Number.isNaN(time));
  const lastActivity = activityTimes.length ? new Date(Math.max(...activityTimes)) : null;

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <MfaBanner />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-6 pb-6 sm:py-12">
        {/* Welcome */}
        <div className="mb-8 sm:mb-10">
          <div className="mb-6">
            <h1 className="page-title">
              {t('dashboard.welcome', { name: user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '' })} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.welcomeSubtitle')}</p>
          </div>

          {/* Stats cards */}
          {loading ? (
            <DashboardStatsSkeleton />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                to="/projects-list"
                linkLabel={t('dashboard.openProjects')}
                tone="purple"
                iconPath="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                value={String(projects.length)}
                label={usage?.projects.limit ? t('dashboard.projectsOfLimit', { limit: usage.projects.limit }) : t('dashboard.statsProjects')}
              />
              <StatCard
                tone="blue"
                iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                value={String(usage?.diagrams.limit && !usage.diagrams.public_counts ? usage.diagrams.current : totalDiagrams)}
                label={
                  !usage?.diagrams.limit
                    ? t('dashboard.statsDiagrams')
                    : usage.diagrams.public_counts
                      ? t('dashboard.diagramsOfLimit', { limit: usage.diagrams.limit })
                      : usage.diagrams.public > 0
                        ? t('dashboard.privateOfLimitPublic', { limit: usage.diagrams.limit, count: usage.diagrams.public })
                        : t('dashboard.privateOfLimit', { limit: usage.diagrams.limit })
                }
              />
              <StatCard
                to={lastDiagram ? `/projects/${lastDiagram.project_id}/diagrams/${lastDiagram.id}` : undefined}
                linkLabel={lastDiagram ? t('dashboard.openLastDiagram', { title: lastDiagram.title }) : undefined}
                tone="green"
                iconPath="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                value={lastActivity ? lastActivity.toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short' }) : '—'}
                label={t('dashboard.statsLastActivity')}
              />
              <StatCard
                to="/subscription"
                linkLabel={t('dashboard.openSubscription')}
                tone="amber"
                iconPath="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                value={usage?.plan_name || user?.subscription?.plan?.name || '—'}
                label={t('dashboard.statsPlan')}
              />
            </div>
          )}
        </div>

        {/* Empty state: no projects yet */}
        {!loading && projects.length === 0 && (
          <EmptyState
            title={t('dashboard.noProjects')}
            description={t('dashboard.emptyDescription')}
            actionLabel={t('dashboard.createProject')}
            onAction={() => navigate('/projects-list?create=true')}
          />
        )}

        {/* Activity + Community impact, then the favorites */}
        {!loading && projects.length > 0 && (
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 min-w-0">
                <ActivityHeatmap data={activity} error={activityError} />
              </div>
              <CommunityImpactCard data={impact} />
            </div>
            <FavoriteDiagramsTable data={favorites} published={published} onUnstar={unstar} onRestar={restar} />
          </div>
        )}

        {/* Widgets grid: AI Usage (left) + Donut Chart (right) */}
        {loading ? (
          <DashboardWidgetsSkeleton />
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Provider Usage Widget */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
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
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{pct}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                  {t('dashboard.noAiUsage')}
                </div>
              )}
            </div>

            {/* Donut chart widget */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                {t('dashboard.statsDiagrams')}
              </h2>
              <DonutChart typeCounts={typeCounts} />
            </div>
          </div>
        ) : null}

        {/* Recent diagrams widget */}
        {!loading && recentDiagrams.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mt-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              {t('dashboard.recentDiagrams')}
            </h2>
            <div className="space-y-2">
              {recentDiagrams.map((d) => {
                const typeIcons: Record<string, string> = { mermaid: '🧜‍♀️', plantuml: '🌱', d2: '📐', dbml: '🗄️' };
                const typeNames: Record<string, string> = { mermaid: 'Mermaid', plantuml: 'PlantUML', d2: 'D2', dbml: 'DBML' };
                return (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/projects/${d.project_id}/diagrams/${d.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <span className="text-lg flex-shrink-0">{typeIcons[d.diagram_type] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{d.title}</span>
                        {published.has(d.id) && <PublicBadge hidden={published.get(d.id)?.hidden} />}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {d.project_emoji} {d.project_name} · {typeNames[d.diagram_type] || d.diagram_type} · {new Date(d.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default DashboardPage;
