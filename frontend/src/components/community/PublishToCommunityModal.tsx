import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import type { CommunityCategory, PublicationCard } from '../../types/community';
import type { UsageSummary } from '../../types/subscription';
import { publicationErrorMessage, publishingFreesSlot, unpublishBlocked } from '../../utils/publicationRules';
import { COMMUNITY_CATEGORIES, COMMUNITY_LICENSE, compactCount, communityLicenseUrl } from '../../utils/community';
import MarkdownEditor from '../MarkdownEditor';
import { TagInput } from './TagInput';

interface PublishToCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
  diagramType: string;
  /** The diagram's own description: the publication always shows it. */
  description: string;
  onDescriptionChange: (description: string) => void;
  /** Save pending edits first, so the publication starts from the latest version. */
  onBeforePublish?: () => Promise<void>;
  /** Called after publishing or unpublishing (to refresh "public" markers). */
  onPublicationChange?: () => void;
}

const PUBLISHABLE = new Set(['mermaid', 'plantuml', 'd2', 'dbml']);

interface Settings {
  category: CommunityCategory;
  tags: string[];
  allowComments: boolean;
}

const DEFAULT_SETTINGS: Settings = { category: 'architecture', tags: [], allowComments: true };

function settingsOf(p: PublicationCard): Settings {
  return { category: p.category, tags: p.tags, allowComments: p.allow_comments };
}

function Section({ title, hint, htmlFor, children }: { title: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  const Title = htmlFor ? 'label' : 'p';
  return (
    <div>
      <Title {...(htmlFor ? { htmlFor } : {})} className="block text-sm font-medium text-gray-900 dark:text-gray-100">{title}</Title>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Publish the current diagram to the community, or change its publication.
 * Left: the description (the diagram's own, edited in place). Right: settings.
 */
export function PublishToCommunityModal({ isOpen, onClose, diagramId, diagramType, description, onDescriptionChange, onBeforePublish, onPublicationChange }: PublishToCommunityModalProps) {
  const { t, i18n } = useTranslation();
  const [existing, setExisting] = useState<PublicationCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The plan usage: published diagrams don't count, so unpublishing needs room.
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const panelRef = useDialogA11y(isOpen, onClose, !busy);
  const publishable = PUBLISHABLE.has(diagramType);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const dirty =
    !!existing &&
    (settings.category !== existing.category || settings.allowComments !== existing.allow_comments || settings.tags.join() !== existing.tags.join());

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    apiService
      .getPublicationOfDiagram(diagramId)
      .then((p) => {
        setExisting(p);
        setSettings(p ? settingsOf(p) : DEFAULT_SETTINGS);
      })
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
    apiService.getUsageSummary().then(setUsage).catch(() => setUsage(null));
  }, [isOpen, diagramId]);

  const refreshUsage = () => {
    apiService.getUsageSummary().then(setUsage).catch(() => undefined);
  };
  const cannotUnpublish = !!existing && unpublishBlocked(usage, existing.hidden);

  if (!isOpen) return null;

  const run = async (action: () => Promise<void>, fallback: () => string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(publicationErrorMessage(err, t, i18n.language) ?? fallback());
    } finally {
      setBusy(false);
    }
  };

  const publish = () =>
    run(
      async () => {
        await onBeforePublish?.();
        const created = await apiService.publishDiagram({
          diagram_id: diagramId,
          category: settings.category,
          tags: settings.tags,
          allow_comments: settings.allowComments,
        });
        setExisting(created);
        setSettings(settingsOf(created));
        setNotice(t('community.publish.published'));
        onPublicationChange?.();
        refreshUsage();
      },
      () => t('community.publish.error'),
    );

  const save = () =>
    run(
      async () => {
        if (!existing) return;
        await onBeforePublish?.();
        const updated = await apiService.updatePublication(existing.id, {
          category: settings.category,
          tags: settings.tags,
          allow_comments: settings.allowComments,
        });
        setExisting(updated);
        setSettings(settingsOf(updated));
        setNotice(t('community.publish.saved'));
      },
      () => t('community.actionError'),
    );

  const unpublish = () =>
    run(
      async () => {
        if (!existing) return;
        await apiService.unpublishDiagram(existing.id);
        setExisting(null);
        setSettings(DEFAULT_SETTINGS);
        setNotice(t('community.publish.unpublished'));
        onPublicationChange?.();
        refreshUsage();
      },
      () => t('community.actionError'),
    );

  const categoryClass = (on: boolean) =>
    `h-8 px-2.5 rounded-md border text-xs text-left truncate transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
      on
        ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium dark:border-purple-400 dark:bg-purple-500/10 dark:text-purple-300'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-gray-700'
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 w-full max-w-5xl h-full max-h-[min(92vh,780px)] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="publish-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {existing ? t('community.publish.manageTitle') : t('community.publish.title')}
              </h3>
              {existing && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  {t('community.publish.statusPublished')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('community.publish.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost btn-sm !px-2" aria-label={t('common.close')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="flex-1 p-5 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : !publishable ? (
          <p className="flex-1 p-5 text-sm text-amber-700 dark:text-amber-400">{t('community.publish.notPublishable')}</p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_21rem]">
            {/* Description: the diagram's own, so editing it here edits the diagram */}
            <section className="flex flex-col min-h-[22rem] md:min-h-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800">
              <div className="px-5 pt-4 pb-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('community.publish.description')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('community.publish.descriptionHint')}</p>
              </div>
              <div className="flex-1 min-h-0 mx-5 mb-5 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <MarkdownEditor
                  key={diagramId}
                  value={description}
                  onChange={onDescriptionChange}
                  placeholder={t('community.publish.descriptionPlaceholder')}
                  maxLength={50000}
                  startEditing={!description.trim()}
                />
              </div>
            </section>

            {/* Settings */}
            <aside className="md:overflow-y-auto bg-gray-50/60 dark:bg-gray-950/40 px-5 py-4 space-y-5">
              {notice && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-3 py-2 rounded-lg text-sm" role="status">
                  {notice}
                </div>
              )}

              {existing && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-300 tabular-nums">
                    <span aria-hidden="true">★</span> {compactCount(existing.stars_count)}
                    <span className="mx-2 text-gray-300 dark:text-gray-700" aria-hidden="true">|</span>
                    <span aria-hidden="true">⑂</span> {compactCount(existing.forks_count)}
                    <span className="sr-only">{t('community.publish.alreadyPublished', { stars: existing.stars_count, forks: existing.forks_count })}</span>
                  </span>
                  <Link to={`/community/${existing.id}`} onClick={onClose} className="ml-auto text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline">
                    {t('community.publish.viewInCommunity')}
                  </Link>
                </div>
              )}

              <Section title={t('community.publish.category')}>
                <div role="radiogroup" aria-label={t('community.publish.category')} className="grid grid-cols-2 gap-1.5">
                  {COMMUNITY_CATEGORIES.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={settings.category === c} onClick={() => set('category', c)} className={categoryClass(settings.category === c)}>
                      {t(`community.categories.${c}`)}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={t('community.publish.tags')} htmlFor="pub-tags">
                <TagInput id="pub-tags" tags={settings.tags} onChange={(tags) => set('tags', tags)} />
              </Section>

              <label htmlFor="pub-comments" className="flex items-start justify-between gap-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{t('community.publish.allowComments')}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('community.publish.commentsHint')}</span>
                </span>
                <span className="relative inline-flex flex-shrink-0 mt-0.5">
                  <input id="pub-comments" type="checkbox" role="switch" checked={settings.allowComments} onChange={(e) => set('allowComments', e.target.checked)} className="peer sr-only" />
                  <span className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-purple-600 peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500/50 dark:bg-gray-700 dark:peer-checked:bg-purple-500" aria-hidden="true" />
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" aria-hidden="true" />
                </span>
              </label>

              <div className="space-y-2 text-xs">
                <p className="flex gap-2 text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{t('community.publish.syncNotice')}</span>
                </p>
                {publishingFreesSlot(usage) && (
                  <p className="flex gap-2 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t('community.publish.limitNote')}</span>
                  </p>
                )}
                <p className="flex gap-2 text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <Trans
                      i18nKey="community.publish.licenseNotice"
                      values={{ license: COMMUNITY_LICENSE }}
                      components={{ licenseLink: <a href={communityLicenseUrl(i18n.language)} target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 dark:text-purple-400 hover:underline" /> }}
                    />
                  </span>
                </p>
                <p className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-2">
                  {t('community.publish.sensitiveWarning')}
                </p>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
            </aside>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-2 justify-end flex-wrap">
          {publishable && !loading && existing && (
            <div className="w-full sm:w-auto sm:mr-auto flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={unpublish}
                disabled={busy || cannotUnpublish}
                aria-describedby={cannotUnpublish ? 'unpublish-blocked' : undefined}
                className="btn btn-danger self-start"
              >
                {t('community.owner.unpublish')}
              </button>
              {cannotUnpublish && usage && (
                <p id="unpublish-blocked" className="text-xs text-gray-600 dark:text-gray-400 sm:max-w-xs">
                  {t('community.owner.unpublishBlocked', { current: usage.diagrams.current, limit: usage.diagrams.limit })}
                </p>
              )}
            </div>
          )}
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">{t('common.close')}</button>
          {publishable && !loading && existing && (
            <button type="button" onClick={save} disabled={busy || !dirty} className="btn btn-primary">
              {busy ? t('community.publish.saving') : t('community.publish.save')}
            </button>
          )}
          {publishable && !loading && !existing && (
            <button type="button" onClick={publish} disabled={busy} className="btn btn-primary">
              {busy ? t('community.publish.publishing') : t('community.publish.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
