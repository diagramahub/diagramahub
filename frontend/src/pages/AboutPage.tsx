import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { type RepositoryStats } from '../services/api';
import { dateLocale } from '../utils/locale';
import { formatStars, starsSpotlight } from '../utils/repositoryStars';

const REPOSITORY_URL = 'https://github.com/diagramahub/diagramahub';
const RELEASES_URL = 'https://github.com/diagramahub/diagramahub/releases';
const X_URL = 'https://x.com/diagramahub';
const CONTACT_EMAIL = 'hi@diagramahub.com';

const GITHUB_PATH =
  'M12 .6a11.4 11.4 0 00-3.6 22.2c.57.1.78-.25.78-.55v-2.17c-3.17.69-3.84-1.34-3.84-1.34-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.53-.29-5.19-1.26-5.19-5.62 0-1.24.44-2.25 1.17-3.05-.12-.29-.51-1.44.11-3 0 0 .96-.31 3.14 1.16A10.9 10.9 0 0112 5.1c.97 0 1.95.13 2.86.39 2.18-1.47 3.13-1.16 3.13-1.16.63 1.56.24 2.71.12 3 .73.8 1.16 1.81 1.16 3.05 0 4.37-2.66 5.32-5.2 5.61.41.35.78 1.03.78 2.08v3.08c0 .3.2.66.79.55A11.4 11.4 0 0012 .6z';
const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

function GitHubIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d={GITHUB_PATH} />
    </svg>
  );
}

function StarIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

/** The call to action of the page: star the repository on GitHub. */
function StarCard({ stats, loading }: { stats: RepositoryStats | null; loading: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const stars = stats?.available ? stats.stars : null;
  const spotlight = starsSpotlight(stars);

  return (
    <div className="w-full rounded-xl bg-white p-5 text-gray-900 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:text-gray-100 dark:ring-white/10 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <GitHubIcon className="h-4 w-4" />
        <span className="font-mono">diagramahub/diagramahub</span>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-8 w-28 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-40 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : spotlight && stars !== null ? (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-4xl font-semibold tracking-tight tabular-nums">
            <StarIcon className="h-8 w-8 text-amber-400" />
            {formatStars(stars, locale)}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('about.star.count', { count: stars })}</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xl font-semibold leading-snug">{t(stars === null ? 'about.star.titleNoCount' : 'about.star.titleFirst')}</p>
          {stars !== null && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <StarIcon className="h-4 w-4 text-amber-400" />
              {t('about.star.soFar', { count: stars })}
            </p>
          )}
        </div>
      )}

      <a href={stats?.url || REPOSITORY_URL} target="_blank" rel="noreferrer" className="btn btn-primary mt-5 w-full">
        <StarIcon className="h-4 w-4" />
        {t('about.star.cta')}
      </a>
      <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{t('about.star.why')}</p>
    </div>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<RepositoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getRepositoryStats()
      .then((data) => !cancelled && setStats(data))
      .catch(() => !cancelled && setStats(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const reasons = [
    { key: 'discover', path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { key: 'trust', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { key: 'momentum', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  const highlights = [
    { key: 'textToDiagram', path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { key: 'privacy', path: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { key: 'ai', path: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  ];

  const links = [
    { key: 'repository', value: 'github.com/diagramahub/diagramahub', href: REPOSITORY_URL, icon: <GitHubIcon /> },
    {
      key: 'xAccount',
      value: '@diagramahub',
      href: X_URL,
      icon: (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.2L5.75 22H2.64l7.25-8.3L2.24 2h6.4l4.43 6.58L18.9 2zm-1.1 18h1.72L7.7 3.9H5.85L17.8 20z" />
        </svg>
      ),
    },
    {
      key: 'contact',
      value: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.73a2.15 2.15 0 002.22 0L21 8m-18 8h18V6H3v10z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="min-h-full bg-gray-50 px-4 pb-10 pt-16 dark:bg-gray-950 sm:px-6 md:pt-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hero (the page's illustration: the one place with a gradient) */}
        <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-violet-800 via-purple-700 to-fuchsia-700 px-6 py-8 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" aria-hidden="true" />
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_20rem]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-purple-100">DiagramaHub</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{t('about.title')}</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-purple-50 sm:text-lg">{t('about.intro')}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 font-semibold">
                  {t('about.currentVersion', { version: __APP_VERSION__ })}
                </span>
                <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-purple-100">
                  {t('about.viewReleases')} <ArrowUpRightIcon />
                </a>
              </div>
            </div>
            <StarCard stats={stats} loading={loading} />
          </div>
        </section>

        {/* Why a star matters */}
        <section className="card p-6 sm:p-8" aria-labelledby="about-star-why">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <StarIcon className="h-4 w-4" />
                {t('about.star.kicker')}
              </p>
              <h2 id="about-star-why" className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('about.star.reasonsTitle')}
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.key} className="rounded-xl bg-gray-50 p-5 dark:bg-gray-800/50">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={reason.path} />
                  </svg>
                </span>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-gray-100">{t(`about.star.reasons.${reason.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">{t(`about.star.reasons.${reason.key}.description`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">{t('about.star.howTitle')}</span> {t('about.star.howSteps')}
            </p>
            <a href={stats?.url || REPOSITORY_URL} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm self-start sm:self-auto">
              <GitHubIcon className="h-4 w-4" />
              {t('about.star.openRepository')}
            </a>
          </div>
        </section>

        {/* What it is */}
        <section aria-labelledby="about-what">
          <h2 id="about-what" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('about.highlightsTitle')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">{t('about.whatIsDescription')}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {highlights.map((highlight) => (
              <article key={highlight.key} className="card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={highlight.path} />
                  </svg>
                </span>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-gray-100">{t(`about.highlights.${highlight.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">{t(`about.highlights.${highlight.key}.description`)}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Mermaid', 'PlantUML', 'D2', 'DBML'].map((technology) => (
              <span key={technology} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {technology}
              </span>
            ))}
          </div>
        </section>

        {/* Connect */}
        <section className="card p-6 sm:p-8" aria-labelledby="about-connect">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="about-connect" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('about.connectTitle')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('about.connectDescription')}</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {links.map((link) => (
              <a
                key={link.key}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                className="group rounded-xl border border-gray-200 p-4 transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-gray-800 dark:hover:border-purple-700 dark:hover:bg-purple-500/10"
              >
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <span>{link.icon}</span>
                  <ArrowUpRightIcon />
                </div>
                <p className="mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">{t(`about.${link.key}`)}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{link.value}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
