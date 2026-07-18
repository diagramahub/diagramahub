import { useTranslation } from 'react-i18next';

const REPOSITORY_URL = 'https://github.com/diagramahub/diagramahub';
const X_URL = 'https://x.com/diagramahub';
const CONTACT_EMAIL = 'hi@diagramahub.com';

interface LinkItem {
  key: 'repository' | 'xAccount' | 'contact';
  value: string;
  href: string;
  icon: React.ReactNode;
}

function ArrowUpRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();
  const links: LinkItem[] = [
    {
      key: 'repository',
      value: 'github.com/diagramahub/diagramahub',
      href: REPOSITORY_URL,
      icon: <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .6a11.4 11.4 0 00-3.6 22.2c.57.1.78-.25.78-.55v-2.17c-3.17.69-3.84-1.34-3.84-1.34-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.53-.29-5.19-1.26-5.19-5.62 0-1.24.44-2.25 1.17-3.05-.12-.29-.51-1.44.11-3 0 0 .96-.31 3.14 1.16A10.9 10.9 0 0112 5.1c.97 0 1.95.13 2.86.39 2.18-1.47 3.13-1.16 3.13-1.16.63 1.56.24 2.71.12 3 .73.8 1.16 1.81 1.16 3.05 0 4.37-2.66 5.32-5.2 5.61.41.35.78 1.03.78 2.08v3.08c0 .3.2.66.79.55A11.4 11.4 0 0012 .6z" /></svg>,
    },
    {
      key: 'xAccount',
      value: '@diagramahub',
      href: X_URL,
      icon: <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.2L5.75 22H2.64l7.25-8.3L2.24 2h6.4l4.43 6.58L18.9 2zm-1.1 18h1.72L7.7 3.9H5.85L17.8 20z" /></svg>,
    },
    {
      key: 'contact',
      value: CONTACT_EMAIL,
      href: `mailto:${CONTACT_EMAIL}`,
      icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.73a2.15 2.15 0 002.22 0L21 8m-18 8h18V6H3v10z" /></svg>,
    },
  ];

  const highlights = [
    { key: 'textToDiagram', icon: '⌘' },
    { key: 'privacy', icon: '◈' },
    { key: 'ai', icon: '✦' },
  ];

  return (
    <main className="min-h-full overflow-hidden bg-gray-50 px-4 py-6 dark:bg-gray-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-violet-800 via-purple-700 to-fuchsia-700 px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-sm">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5h5v5H5V5zm9 9h5v5h-5v-5zM10 7.5h4M7.5 10v4" /></svg>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-purple-100">DiagramaHub</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{t('about.title')}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-purple-50 sm:text-lg">{t('about.intro')}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
            <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{t('about.whatIsTitle')}</span>
            <p className="mt-4 text-lg leading-8 text-gray-700 dark:text-gray-200">{t('about.whatIsDescription')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Mermaid', 'PlantUML', 'D2', 'DBML'].map((technology) => (
                <span key={technology} className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">{technology}</span>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-6 shadow-sm dark:border-purple-900/60 dark:from-purple-950/50 dark:to-fuchsia-950/30 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-lg text-white shadow-lg shadow-purple-500/30">↗</div>
            <h2 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">{t('about.openSourceTitle')}</h2>
            <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">{t('about.openSourceDescription')}</p>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200">
              {t('about.exploreRepository')} <ArrowUpRightIcon />
            </a>
          </article>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('about.highlightsTitle')}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {highlights.map((highlight) => (
              <article key={highlight.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-lg font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{highlight.icon}</span>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{t(`about.highlights.${highlight.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{t(`about.highlights.${highlight.key}.description`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">DiagramaHub</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{t('about.connectTitle')}</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('about.connectDescription')}</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {links.map((link) => (
              <a key={link.key} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="group rounded-xl border border-gray-200 p-4 transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:hover:border-purple-700 dark:hover:bg-purple-900/20">
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400"><span>{link.icon}</span><ArrowUpRightIcon /></div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(`about.${link.key}`)}</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{link.value}</p>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
