import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import type { CommunityCategory, CommunityLicense, PublicationCard } from '../../types/community';
import { COMMUNITY_CATEGORIES, COMMUNITY_LICENSES, MAX_TAGS, parseTags } from '../../utils/community';

interface PublishToCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
  diagramType: string;
  description: string;
}

const PUBLISHABLE = new Set(['mermaid', 'plantuml', 'd2', 'dbml']);
const field =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100';
const primary =
  'bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors';
const secondary =
  'px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/** Publish the current diagram to the community, or manage its publication. */
export function PublishToCommunityModal({ isOpen, onClose, diagramId, diagramType, description }: PublishToCommunityModalProps) {
  const { t } = useTranslation();
  const [existing, setExisting] = useState<PublicationCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CommunityCategory>('architecture');
  const [tags, setTags] = useState('');
  const [license, setLicense] = useState<CommunityLicense>('cc-by-4.0');
  const [text, setText] = useState(description);
  const [allowForks, setAllowForks] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useDialogA11y(isOpen, onClose, !busy);
  const publishable = PUBLISHABLE.has(diagramType);
  const parsedTags = parseTags(tags);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNotice(null);
    setText(description);
    setLoading(true);
    apiService
      .getPublicationOfDiagram(diagramId)
      .then(setExisting)
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, [isOpen, diagramId, description]);

  if (!isOpen) return null;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await apiService.publishDiagram({
        diagram_id: diagramId,
        category,
        tags: parsedTags,
        description: text,
        license,
        allow_forks: allowForks && license !== 'all-rights-reserved',
        allow_comments: allowComments,
        auto_update: autoUpdate,
      });
      setExisting(created);
      setNotice(t('community.publish.published'));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? t('community.tooFast') : t('community.publish.error'));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      setExisting(await apiService.updatePublication(existing.id, { refresh_content: true }));
      setNotice(t('community.owner.refreshed'));
    } catch {
      setError(t('community.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await apiService.unpublishDiagram(existing.id);
      setExisting(null);
      setNotice(t('community.publish.unpublished'));
    } catch {
      setError(t('community.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const checkbox = (id: string, checked: boolean, onChange: (v: boolean) => void, label: string, disabled = false) => (
    <label htmlFor={id} className={`flex items-start gap-2 text-sm ${disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700" />
      {label}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="publish-title" className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="publish-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('community.publish.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('community.publish.subtitle')}</p>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {notice && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm" role="status">{notice}</div>}
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : !publishable ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t('community.publish.notPublishable')}</p>
          ) : existing ? (
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>{t('community.publish.alreadyPublished', { stars: existing.stars_count, forks: existing.forks_count })}</p>
              <Link to={`/community/${existing.id}`} onClick={onClose} className="inline-block font-medium text-purple-600 dark:text-purple-400 hover:underline">
                {t('community.publish.viewInCommunity')}
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.publish.snapshotHint')}</p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pub-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('community.publish.category')} <span className="text-red-500">*</span>
                  </label>
                  <select id="pub-category" value={category} onChange={(e) => setCategory(e.target.value as CommunityCategory)} className={field}>
                    {COMMUNITY_CATEGORIES.map((c) => <option key={c} value={c}>{t(`community.categories.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="pub-license" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.publish.license')}</label>
                  <select id="pub-license" value={license} onChange={(e) => setLicense(e.target.value as CommunityLicense)} className={field}>
                    {COMMUNITY_LICENSES.map((l) => <option key={l} value={l}>{t(`community.licenses.${l}`)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="pub-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.publish.tags')}</label>
                <input id="pub-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('community.publish.tagsPlaceholder')} className={field} />
                {parsedTags.length > MAX_TAGS && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('community.publish.tooManyTags', { max: MAX_TAGS })}</p>}
              </div>
              <div>
                <label htmlFor="pub-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.publish.description')}</label>
                <textarea id="pub-description" rows={3} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} className={`${field} resize-none`} />
              </div>
              <fieldset className="space-y-2">
                {checkbox('pub-forks', allowForks && license !== 'all-rights-reserved', setAllowForks, t('community.publish.allowForks'), license === 'all-rights-reserved')}
                {checkbox('pub-comments', allowComments, setAllowComments, t('community.publish.allowComments'))}
                {checkbox('pub-auto', autoUpdate, setAutoUpdate, t('community.publish.autoUpdate'))}
              </fieldset>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-xs">
                {t('community.publish.sensitiveWarning')}
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex gap-3 justify-end flex-wrap">
          <button type="button" onClick={onClose} disabled={busy} className={secondary}>{t('common.close')}</button>
          {publishable && !loading && existing && (
            <>
              <button type="button" onClick={unpublish} disabled={busy} className="px-6 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400">
                {t('community.owner.unpublish')}
              </button>
              <button type="button" onClick={refresh} disabled={busy} className={primary}>{t('community.owner.refresh')}</button>
            </>
          )}
          {publishable && !loading && !existing && (
            <button type="button" onClick={publish} disabled={busy || parsedTags.length > MAX_TAGS} className={primary}>
              {busy ? t('community.publish.publishing') : t('community.publish.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
