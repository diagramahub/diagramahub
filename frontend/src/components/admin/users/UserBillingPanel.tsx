import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import { AdminSubscriptionEntry, AdminUserBilling } from '../../../types/auth';
import { apiErrorMessage } from '../../../utils/apiError';
import { formatDate, formatMoney } from '../../../utils/adminUsers';
import { StatusPill } from './shared';

const INVOICE_TONES: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  paid: 'green',
  open: 'amber',
  uncollectible: 'red',
  void: 'gray',
  draft: 'gray',
};

const SUBSCRIPTION_TONES: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  active: 'green',
  past_due: 'amber',
  incomplete: 'amber',
  cancelled: 'gray',
  expired: 'gray',
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</h3>;
}

/** Payments tab of the user detail: current plan, totals, invoices and subscription history. */
export function UserBillingPanel({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [billing, setBilling] = useState<AdminUserBilling | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBilling(await apiService.adminGetUserBilling(userId));
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.billingError'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('admin.users.billingLoading')}</p>;
  }
  if (error || !billing) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button type="button" onClick={() => void load()} className="btn btn-secondary btn-sm mt-3">
          {t('admin.users.retry')}
        </button>
      </div>
    );
  }

  const lang = i18n.language;
  const current = billing.current;
  const subStatus = (s: AdminSubscriptionEntry) =>
    t(`admin.users.subscriptionStatus.${s.status}`, { defaultValue: s.status });
  const totals = Object.entries(billing.total_paid);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t('admin.users.currentPlan')}>
          {current ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {current.plan_name ?? '—'}
              {billing.is_paying && <StatusPill tone="green">{t('admin.users.paying')}</StatusPill>}
            </span>
          ) : (
            <span className="font-normal text-gray-500 dark:text-gray-400">{t('admin.users.noSubscription')}</span>
          )}
        </Stat>
        <Stat label={t('admin.users.totalPaid')}>
          {totals.length === 0
            ? formatMoney(0, 'USD', lang)
            : totals.map(([currency, amount]) => <span key={currency} className="block tabular-nums">{formatMoney(amount, currency, lang)}</span>)}
        </Stat>
        <Stat label={t('admin.users.invoicesCount')}>
          <span className="tabular-nums">{billing.invoices.length}</span>
        </Stat>
      </div>

      {current && (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{t('admin.users.subscribedSince')}</dt>
            <dd className="text-gray-900 dark:text-gray-100">{formatDate(current.started_at, lang)}</dd>
          </div>
          {current.current_period_end && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{t('admin.users.nextCharge')}</dt>
              <dd className="text-gray-900 dark:text-gray-100">{formatDate(current.current_period_end, lang)}</dd>
            </div>
          )}
          {current.stripe_customer_id && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{t('admin.users.provider')} · {t('admin.users.customerId')}</dt>
              <dd className="break-all font-mono text-xs text-gray-700 dark:text-gray-300">
                {current.payment_provider} · {current.stripe_customer_id}
              </dd>
            </div>
          )}
          {current.stripe_subscription_id && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{t('admin.users.subscriptionId')}</dt>
              <dd className="break-all font-mono text-xs text-gray-700 dark:text-gray-300">{current.stripe_subscription_id}</dd>
            </div>
          )}
        </dl>
      )}

      <section>
        <SectionTitle>{t('admin.users.invoices')}</SectionTitle>
        {!billing.provider_configured && (
          <p className="mb-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {t('admin.users.providerNotConfigured')}
          </p>
        )}
        {billing.invoices_error && (
          <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('admin.users.invoicesError')}
          </p>
        )}
        {billing.invoices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.noInvoices')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t('subscription.billing.date')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('subscription.billing.description')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('subscription.billing.amount')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('subscription.billing.status')}</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">{t('admin.users.viewInvoice')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {billing.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(invoice.paid_at || invoice.created_at, lang)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{invoice.description}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {formatMoney(invoice.amount, invoice.currency, lang)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <StatusPill tone={INVOICE_TONES[invoice.status] ?? 'gray'}>
                        {t(`admin.users.invoiceStatus.${invoice.status}`, { defaultValue: invoice.status })}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {(invoice.hosted_invoice_url || invoice.invoice_pdf) && (
                        <a
                          href={invoice.hosted_invoice_url || invoice.invoice_pdf || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-purple-600 hover:underline dark:text-purple-400"
                        >
                          {t('admin.users.viewInvoice')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {billing.subscriptions.length > 0 && (
        <section>
          <SectionTitle>{t('admin.users.subscriptionHistory')}</SectionTitle>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {billing.subscriptions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{s.plan_name ?? s.plan_code ?? '—'}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(s.started_at || s.created_at, lang)}
                    {s.cancelled_at && ` → ${formatDate(s.cancelled_at, lang)}`}
                  </span>
                </span>
                <StatusPill tone={SUBSCRIPTION_TONES[s.status] ?? 'gray'}>{subStatus(s)}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
