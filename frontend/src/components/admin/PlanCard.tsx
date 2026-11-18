import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan } from '../../types/subscription';
import CurrencyPriceTable from './CurrencyPriceTable';
import Tooltip from '../Tooltip';
import { dateLocale } from '../../utils/locale';
import { formatAmount, isPaid, isUnlimited, needsGateway } from '../../utils/plans';

interface PlanCardProps {
  plan: Plan;
  /** An action on this plan is running. */
  busy: boolean;
  onEdit: () => void;
  onToggleOffered: () => void;
  onDelete: () => void;
  onPricesChanged: () => void;
}

function LimitRow({ unlimited, label, icon }: { unlimited: boolean; label: string; icon: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <svg className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <span className={unlimited ? 'font-medium text-purple-700 dark:text-purple-300' : ''}>{label}</span>
    </li>
  );
}

const FOLDER_ICON = 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z';
const DIAGRAM_ICON = 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zM7 10v4a2 2 0 002 2h5';
const USERS_ICON = 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z';

/** One plan: price, limits, subscribers, gateway, and its actions. */
export function PlanCard({ plan, busy, onEdit, onToggleOffered, onDelete, onPricesChanged }: PlanCardProps) {
  const { t, i18n } = useTranslation();
  const [showCurrencies, setShowCurrencies] = useState(false);
  const locale = dateLocale(i18n.language);
  const paid = isPaid(plan);
  const otherPrices = Object.entries(plan.prices ?? {}).filter(([currency]) => currency !== 'usd');
  const canDelete = !plan.is_free && plan.active_subscriptions === 0;
  const switchId = `plan-offered-${plan.id}`;

  return (
    <article
      className={`card flex flex-col ${plan.is_active ? '' : 'opacity-75'}`}
      aria-labelledby={`plan-name-${plan.id}`}
    >
      <div className="p-5 flex-1">
        {/* Name and badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={`plan-name-${plan.id}`} className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {plan.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <code className="text-[11px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">
                {plan.code}
              </code>
              {!plan.is_active && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {t('admin.plans.inactive')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mt-4">
          {paid ? (
            <p className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
                {formatAmount(plan.price_usd, 'usd', locale)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('admin.plans.perMonth')}</span>
            </p>
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{t('admin.plans.free')}</p>
          )}
          {otherPrices.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('admin.plans.otherCurrencies', {
                list: otherPrices.map(([currency, amount]) => formatAmount(amount, currency, locale)).join(' · '),
              })}
            </p>
          )}
          {plan.is_free && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('admin.plans.defaultPlan')}</p>}
        </div>

        {plan.description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>}

        {/* Limits and subscribers */}
        <ul className="mt-4 space-y-1.5">
          <LimitRow
            icon={FOLDER_ICON}
            unlimited={isUnlimited(plan.max_projects)}
            label={isUnlimited(plan.max_projects) ? t('admin.plans.unlimitedProjects') : t('admin.plans.projects', { count: plan.max_projects ?? 0 })}
          />
          <LimitRow
            icon={DIAGRAM_ICON}
            unlimited={isUnlimited(plan.max_diagrams)}
            label={isUnlimited(plan.max_diagrams) ? t('admin.plans.unlimitedDiagrams') : t('admin.plans.diagrams', { count: plan.max_diagrams ?? 0 })}
          />
          <LimitRow icon={USERS_ICON} unlimited={false} label={t('admin.plans.subscribers', { count: plan.active_subscriptions })} />
        </ul>

        {/* Payment gateway (paid plans only) */}
        {paid && (
          <div className="mt-4">
            {needsGateway(plan) ? (
              <Tooltip content={t('admin.plans.notSynced')}>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {t('admin.plans.noGateway')}
                </span>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('admin.plans.gatewaySynced', {
                  provider: plan.gateway_config?.provider === 'stripe' ? 'Stripe' : plan.gateway_config?.provider,
                })}
              </span>
            )}
          </div>
        )}

        {/* Currencies (paid plans) */}
        {paid && showCurrencies && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <CurrencyPriceTable plan={plan} onPriceChanged={onPricesChanged} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-1.5">
        {!plan.is_free ? (
          <label htmlFor={switchId} className="flex items-center gap-2 mr-auto cursor-pointer">
            <button
              id={switchId}
              type="button"
              role="switch"
              aria-checked={plan.is_active}
              aria-label={t('admin.plans.toggleLabel', { name: plan.name })}
              disabled={busy}
              onClick={onToggleOffered}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-wait ${
                plan.is_active ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${plan.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {plan.is_active ? t('admin.plans.available') : t('admin.plans.unavailable')}
            </span>
          </label>
        ) : (
          <span className="mr-auto" />
        )}

        {paid && (
          <button type="button" onClick={() => setShowCurrencies((v) => !v)} aria-expanded={showCurrencies} className="btn btn-ghost btn-sm !px-2">
            {showCurrencies ? t('admin.plans.hideCurrencies') : t('admin.plans.currencies')}
          </button>
        )}
        <button type="button" onClick={onEdit} className="btn btn-secondary btn-sm">
          {t('admin.plans.edit')}
        </button>
        {!plan.is_free &&
          (canDelete ? (
            <button type="button" onClick={onDelete} className="btn btn-danger btn-sm !px-2" aria-label={t('admin.plans.delete')} title={t('admin.plans.delete')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <Tooltip content={t('admin.plans.deleteDisabled')}>
              <button type="button" disabled className="btn btn-danger btn-sm !px-2" aria-label={t('admin.plans.deleteDisabled')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </Tooltip>
          ))}
      </div>
    </article>
  );
}
