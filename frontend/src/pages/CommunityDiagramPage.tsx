import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiService from '../services/api';
import type { CommunityComment, PublicationDetail } from '../types/community';
import type { Project } from '../types/project';
import { compactCount, threadComments } from '../utils/community';
import { dateLocale } from '../utils/locale';
import { apiErrorStatus } from '../utils/apiError';
import { useAuth } from '../contexts/AuthContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import ConfirmModal from '../components/ConfirmModal';
import { CommunityDiagramViewer } from '../components/community/CommunityDiagramViewer';
import { CommunityAvatar } from '../components/community/CommunityAvatar';
import { TYPE_BADGES } from '../components/community/typeBadges';

const primary = 'btn btn-primary';
const secondary = 'btn btn-secondary';
const field = 'input';

/** A published diagram: preview, code, actions and public comments. */
export default function CommunityDiagramPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pub, setPub] = useState<PublicationDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [showFork, setShowFork] = useState(false);
  const [report, setReport] = useState<{ type: 'diagram' | 'comment'; id: string } | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadComments = useCallback(async () => {
    if (!id) return;
    try {
      setComments(await apiService.listCommunityComments(id));
    } catch {
      /* the page still works without comments */
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setState('loading');
    apiService
      .getPublication(id)
      .then((detail) => {
        setPub(detail);
        setState('ready');
      })
      .catch((err: unknown) => setState(apiErrorStatus(err) === 404 ? 'not_found' : 'error'));
    loadComments();
  }, [id, loadComments]);

  if (state === 'loading') return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;
  if (state !== 'ready' || !pub) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">{state === 'not_found' ? t('community.notFound') : t('community.loadError')}</p>
        <Link to="/community" className="mt-3 inline-block text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline">
          {t('community.backToCommunity')}
        </Link>
      </div>
    );
  }

  const badge = TYPE_BADGES[pub.diagram_type];
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short', year: 'numeric' });
  const forksAllowed = pub.allow_forks && pub.license !== 'all-rights-reserved';

  const toggleStar = async () => {
    const next = !pub.starred_by_me;
    try {
      const result = await apiService.setStar(pub.id, next);
      setPub({ ...pub, starred_by_me: result.starred, stars_count: result.stars_count });
    } catch {
      notify(t('community.actionError'));
    }
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      await apiService.addCommunityComment(pub.id, { text: text.trim(), parent_id: replyTo?.id });
      setText('');
      setReplyTo(null);
      setPub({ ...pub, comments_count: pub.comments_count + 1 });
      await loadComments();
    } catch (err: unknown) {
      notify(apiErrorStatus(err) === 429 ? t('community.tooFast') : t('community.actionError'));
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (comment: CommunityComment) => {
    try {
      await apiService.deleteCommunityComment(pub.id, comment.id);
      await loadComments();
    } catch {
      notify(t('community.actionError'));
    }
  };

  const moderate = async (changes: { featured?: boolean; hidden?: boolean }) => {
    try {
      setPub(await apiService.moderatePublication(pub.id, changes));
    } catch {
      notify(t('community.actionError'));
    }
  };

  const unpublish = async () => {
    try {
      await apiService.unpublishDiagram(pub.id);
      navigate('/community');
    } catch {
      notify(t('community.actionError'));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify(t('community.linkCopied'));
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="px-4 pb-8 pt-16 sm:px-6 md:pt-6 max-w-7xl mx-auto">
      <Link to="/community" className="text-sm text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
        ← {t('community.backToCommunity')}
      </Link>

      {pub.hidden && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {t('community.hiddenNotice')}
        </div>
      )}

      {/* Header: identity on the left, the main actions always in view on the right */}
      <header className="mt-3 flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
            <span className="badge">{t(`community.categories.${pub.category}`)}</span>
            {pub.featured && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {t('community.featured')}
              </span>
            )}
          </div>
          <h1 className="page-title mt-1.5 break-words">{pub.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <CommunityAvatar name={pub.owner_name} />
            <span className="font-medium text-gray-700 dark:text-gray-300">{pub.owner_name}</span>
            <span aria-hidden="true">·</span>
            {t('community.publishedOn', { date: formatDate(pub.published_at) })}
            <span aria-hidden="true">·</span>
            {t(`community.licenses.${pub.license}`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
          <button type="button" onClick={toggleStar} aria-pressed={pub.starred_by_me} className={`${secondary} ${pub.starred_by_me ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            <span aria-hidden="true">{pub.starred_by_me ? '★' : '☆'}</span>
            {pub.starred_by_me ? t('community.starred') : t('community.star')}
            <span className="text-gray-400 dark:text-gray-500 tabular-nums">{compactCount(pub.stars_count)}</span>
          </button>
          <button type="button" onClick={() => setShowFork(true)} disabled={!forksAllowed} className={primary} title={forksAllowed ? undefined : t('community.forksOff')}>
            <span aria-hidden="true">⑂</span>
            {t('community.fork')}
            <span className="text-purple-200 tabular-nums">{compactCount(pub.forks_count)}</span>
          </button>
          <button type="button" onClick={copyLink} className={`${secondary} !px-2.5`} aria-label={t('community.copyLink')} title={t('community.copyLink')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </div>
      </header>
      {!forksAllowed && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 lg:text-right">{t('community.forksOff')}</p>}

      {/* The diagram gets the full width: large diagrams need room */}
      <div className="mt-5">
        <CommunityDiagramViewer
          cacheKey={`${pub.id}:${pub.updated_at}`}
          content={pub.content}
          diagramType={pub.diagram_type}
          title={pub.title}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6 items-start">
        <div className="min-w-0 space-y-8">
          <DetailTabs publication={pub} onCopied={() => notify(t('community.detail.codeCopied'))} />

          <section aria-labelledby="comments-title">
            <h2 id="comments-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t('community.commentsTitle', { count: comments.length })}
            </h2>
            {pub.allow_comments ? (
              <form onSubmit={postComment} className="mb-5">
                {replyTo && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('community.replyingTo', { name: replyTo.author_name })}{' '}
                    <button type="button" onClick={() => setReplyTo(null)} className="text-purple-600 dark:text-purple-400 hover:underline">
                      {t('common.cancel')}
                    </button>
                  </p>
                )}
                <label htmlFor="comment-text" className="sr-only">{t('community.commentPlaceholder')}</label>
                <textarea id="comment-text" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('community.commentPlaceholder')} className={`${field} h-auto py-2 resize-y min-h-[4.5rem]`} />
                <div className="flex justify-between items-center mt-2 gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t('community.commentHint')}</span>
                  <button type="submit" disabled={posting || !text.trim()} className="btn btn-primary">
                    {t('community.comment')}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('community.commentsOff')}</p>
            )}
            <ul className="space-y-3">
              {threadComments(comments).map(({ comment, replies }) => (
                <li key={comment.id}>
                  <CommentItem comment={comment} language={i18n.language} onReply={pub.allow_comments ? setReplyTo : undefined} onDelete={deleteComment} onReport={(c) => setReport({ type: 'comment', id: c.id })} />
                  {replies.length > 0 && (
                    <ul className="ml-8 mt-2 space-y-2">
                      {replies.map((r) => (
                        <li key={r.id}>
                          <CommentItem comment={r} language={i18n.language} onDelete={deleteComment} onReport={(c) => setReport({ type: 'comment', id: c.id })} reply />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {comments.length === 0 && <li className="text-sm text-gray-500 dark:text-gray-400">{t('community.noComments')}</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6">
          <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('community.detail.details')}</p>
            <dl className="space-y-1.5">
              {[
                [t('community.detail.stars'), compactCount(pub.stars_count)],
                [t('community.forks'), compactCount(pub.forks_count)],
                [t('community.views'), compactCount(pub.views_count)],
                [t('community.comments'), compactCount(comments.length)],
                [t('community.updated'), formatDate(pub.updated_at)],
                [t('community.detail.license'), t(`community.licenses.${pub.license}`)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {pub.more_from_owner.length > 0 && (
            <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('community.moreFromAuthor')}</p>
              <ul className="space-y-1.5 text-sm">
                {pub.more_from_owner.map((m) => (
                  <li key={m.id} className="truncate">
                    <Link to={`/community/${m.id}`} className="text-purple-600 dark:text-purple-400 hover:underline" title={m.title}>{m.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pub.is_owner && (
            <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('community.owner.title')}</p>
              {pub.source_diagram_id && (
                <button type="button" onClick={async () => { try { setPub(await apiService.updatePublication(pub.id, { refresh_content: true })); notify(t('community.owner.refreshed')); } catch { notify(t('community.owner.sourceGone')); } }} className="w-full text-left text-sm text-purple-600 dark:text-purple-400 hover:underline">
                  {t('community.owner.refresh')}
                </button>
              )}
              <button type="button" onClick={() => setConfirmUnpublish(true)} className="w-full text-left text-sm text-red-600 dark:text-red-400 hover:underline">
                {t('community.owner.unpublish')}
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="rounded-lg bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('community.admin.title')}</p>
              <button type="button" onClick={() => moderate({ featured: !pub.featured })} className="w-full text-left text-sm text-purple-600 dark:text-purple-400 hover:underline">
                {pub.featured ? t('community.admin.unfeature') : t('community.admin.feature')}
              </button>
              <button type="button" onClick={() => moderate({ hidden: !pub.hidden })} className="w-full text-left text-sm text-red-600 dark:text-red-400 hover:underline">
                {pub.hidden ? t('community.admin.restore') : t('community.admin.hide')}
              </button>
              {!pub.is_owner && (
                <button type="button" onClick={() => setConfirmUnpublish(true)} className="w-full text-left text-sm text-red-600 dark:text-red-400 hover:underline">
                  {t('community.admin.remove')}
                </button>
              )}
            </div>
          )}

          {!pub.is_owner && (
            <button type="button" onClick={() => setReport({ type: 'diagram', id: pub.id })} className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
              ⚑ {t('community.reportDiagram')}
            </button>
          )}
        </aside>
      </div>

      {showFork && <ForkDialog publication={pub} onClose={() => setShowFork(false)} onForked={(projectId, diagramId) => navigate(`/projects/${projectId}/diagrams/${diagramId}`)} />}
      {report && <ReportDialog target={report} onClose={() => setReport(null)} onSent={() => { setReport(null); notify(t('community.reportSent')); }} />}
      <ConfirmModal
        isOpen={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        onConfirm={unpublish}
        title={t('community.owner.unpublishTitle')}
        message={t('community.owner.unpublishMessage')}
        confirmText={t('community.owner.unpublish')}
        isDangerous
      />
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-md shadow-lg max-w-md z-50 text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

const DESCRIPTION_COLLAPSED_HEIGHT = 320;

/** Description and code of a publication, one at a time; long ones collapse or scroll. */
function DetailTabs({ publication: pub, onCopied }: { publication: PublicationDetail; onCopied: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'description' | 'code'>(pub.description ? 'description' : 'code');
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const lines = pub.content.split('\n');

  useLayoutEffect(() => {
    const node = descriptionRef.current;
    if (node) setOverflows(node.scrollHeight > DESCRIPTION_COLLAPSED_HEIGHT + 40);
  }, [pub.description, tab]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pub.content);
      onCopied();
    } catch {
      /* clipboard blocked */
    }
  };

  const tabClass = (on: boolean) =>
    `h-10 px-3 text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/50 ${
      on
        ? 'text-gray-900 dark:text-white font-medium shadow-[inset_0_-2px_0_theme(colors.purple.600)] dark:shadow-[inset_0_-2px_0_theme(colors.purple.400)]'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
    }`;

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 px-2">
        <div role="tablist" aria-label={pub.title} className="flex gap-1">
          <button type="button" role="tab" aria-selected={tab === 'description'} onClick={() => setTab('description')} className={tabClass(tab === 'description')}>
            {t('community.detail.description')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')} className={tabClass(tab === 'code')}>
            {t('community.detail.code')}
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{t('community.detail.lines', { count: lines.length })}</span>
          </button>
        </div>
        {tab === 'code' && (
          <button type="button" onClick={copyCode} className="btn btn-ghost btn-sm ml-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {t('community.detail.copyCode')}
          </button>
        )}
      </div>

      {tab === 'description' ? (
        <div className="p-4 sm:p-5">
          {pub.description ? (
            <>
              <div className="relative">
                <div
                  ref={descriptionRef}
                  className={`prose prose-sm max-w-none break-words dark:prose-invert prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-pre:bg-gray-50 prose-pre:text-gray-800 dark:prose-pre:bg-gray-950 dark:prose-pre:text-gray-200 ${
                    overflows && !expanded ? 'overflow-hidden' : ''
                  }`}
                  style={overflows && !expanded ? { maxHeight: DESCRIPTION_COLLAPSED_HEIGHT } : undefined}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{pub.description}</ReactMarkdown>
                </div>
                {overflows && !expanded && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-gray-900" aria-hidden="true" />
                )}
              </div>
              {overflows && (
                <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="btn btn-ghost btn-sm mt-2 -ml-2 text-purple-600 dark:text-purple-400">
                  {expanded ? t('community.detail.showLess') : t('community.detail.showMore')}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('community.detail.noDescription')}</p>
          )}
          {pub.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {pub.tags.map((tag) => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[32rem] overflow-auto bg-gray-50 dark:bg-gray-950 rounded-b-lg">
          <pre className="text-xs leading-5 font-mono text-gray-800 dark:text-gray-200 py-3">
            {lines.map((line, index) => (
              <div key={index} className="flex">
                <span className="sticky left-0 w-12 flex-shrink-0 select-none pr-3 text-right text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-950" aria-hidden="true">
                  {index + 1}
                </span>
                <code className="pr-4 whitespace-pre">{line || ' '}</code>
              </div>
            ))}
          </pre>
        </div>
      )}
    </section>
  );
}

function CommentItem({ comment, language, onReply, onDelete, onReport, reply = false }: {
  comment: CommunityComment;
  language: string;
  onReply?: (c: CommunityComment) => void;
  onDelete: (c: CommunityComment) => void;
  onReport: (c: CommunityComment) => void;
  reply?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <CommunityAvatar name={comment.author_name} />
      <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 ${reply ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-950/50'}`}>
        <p className="text-xs text-gray-700 dark:text-gray-300">
          <strong>{comment.author_name}</strong>
          {comment.is_publication_owner && (
            <span className="ml-1 text-[10px] px-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{t('community.authorBadge')}</span>
          )}
          <span className="text-gray-400 dark:text-gray-500"> · {new Date(comment.created_at).toLocaleDateString(dateLocale(language))}</span>
        </p>
        <div className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.text}</ReactMarkdown>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
          {onReply && <button type="button" onClick={() => onReply(comment)} className="hover:text-purple-600">{t('community.reply')}</button>}
          {comment.can_delete && <button type="button" onClick={() => onDelete(comment)} className="hover:text-red-600">{t('community.delete')}</button>}
          <button type="button" onClick={() => onReport(comment)} className="hover:text-red-600">{t('community.report')}</button>
        </div>
      </div>
    </div>
  );
}

function ForkDialog({ publication, onClose, onForked }: { publication: PublicationDetail; onClose: () => void; onForked: (projectId: string, diagramId: string) => void }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState(t('community.forkTitleDefault', { title: publication.title }).slice(0, 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useDialogA11y(true, onClose, !busy);

  useEffect(() => {
    apiService.getProjects().then((list) => {
      setProjects(list);
      setProjectId(list[0]?.id ?? '');
    });
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiService.forkPublication(publication.id, { project_id: projectId, title: title.trim() || undefined });
      onForked(result.project_id, result.diagram_id);
    } catch (err: unknown) {
      setError(apiErrorStatus(err) === 403 ? t('community.forkLimit') : t('community.actionError'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="fork-title" className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 id="fork-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('community.fork')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('community.forkDescription')}</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="fork-project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.forkProject')}</label>
            <select id="fork-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
            {projects.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('community.forkNoProjects')}</p>}
          </div>
          <div>
            <label htmlFor="fork-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.forkName')}</label>
            <input id="fork-name" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.forkAttribution')}</p>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondary}>{t('common.cancel')}</button>
          <button type="button" onClick={submit} disabled={busy || !projectId} className={primary}>{busy ? t('community.forking') : t('community.forkConfirm')}</button>
        </div>
      </div>
    </div>
  );
}

function ReportDialog({ target, onClose, onSent }: { target: { type: 'diagram' | 'comment'; id: string }; onClose: () => void; onSent: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useDialogA11y(true, onClose, !busy);

  const submit = async () => {
    setBusy(true);
    try {
      await apiService.reportCommunity({ target_type: target.type, target_id: target.id, reason: reason.trim() });
      onSent();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="report-title" className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 id="report-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('community.reportTitle')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('community.reportDescription')}</p>
        </div>
        <div className="px-6 py-4">
          <label htmlFor="report-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('community.reportReason')}</label>
          <textarea id="report-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} h-auto py-2 resize-none`} />
          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{t('community.actionError')}</p>}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-3 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondary}>{t('common.cancel')}</button>
          <button type="button" onClick={submit} disabled={busy || reason.trim().length < 3} className="btn btn-destructive">
            {t('community.reportSend')}
          </button>
        </div>
      </div>
    </div>
  );
}
