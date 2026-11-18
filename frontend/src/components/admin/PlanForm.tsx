import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { Plan, PlanCreate, PlanUpdate, CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';
import { apiErrorMessage } from '../../utils/apiError';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { isUnlimited } from '../../utils/plans';

const NON_USD_CURRENCIES = SUPPORTED_CURRENCIES.filter((c) => c !== 'usd');

interface PlanFormProps {
  /** null: create a new plan. */
  plan: Plan | null;
  onClose: () => void;
  /** Called with the saved plan's name. */
  onSuccess: (name: string) => void;
}

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const helpClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

/** Create or edit a plan: name, code, price (USD and other currencies), limits, availability. */
export default function PlanForm({ plan, onClose, onSuccess }: PlanFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useDialogA11y(true, onClose, !loading);

  const [name, setName] = useState(plan?.name || '');
  const [code, setCode] = useState(plan?.code || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [priceUsd, setPriceUsd] = useState(plan?.price_usd?.toString() || '0');
  const [maxProjects, setMaxProjects] = useState(isUnlimited(plan?.max_projects) ? '' : String(plan?.max_projects ?? ''));
  const [maxDiagrams, setMaxDiagrams] = useState(isUnlimited(plan?.max_diagrams) ? '' : String(plan?.max_diagrams ?? ''));
  const [unlimitedProjects, setUnlimitedProjects] = useState(plan ? isUnlimited(plan.max_projects) : false);
  const [unlimitedDiagrams, setUnlimitedDiagrams] = useState(plan ? isUnlimited(plan.max_diagrams) : false);
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);

  // Prices in other currencies (only when creating; an existing plan manages them on its card).
  const [currencyPrices, setCurrencyPrices] = useState<Record<string, string>>({});
  const [newCurrency, setNewCurrency] = useState('');

  const hasSubscribers = plan ? plan.active_subscriptions > 0 : false;
  const isFreePlan = plan?.is_free || false;
  const availableCurrencies = NON_USD_CURRENCIES.filter((c) => !(c in currencyPrices));
  const titleId = 'plan-form-title';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError(t('admin.plans.form.errors.name'));
    if (!code.trim()) return setError(t('admin.plans.form.errors.code'));
    const price = parseFloat(priceUsd);
    if (isNaN(price) || price < 0) return setError(t('admin.plans.form.errors.price'));

    let projects: number | null = null;
    if (!unlimitedProjects) {
      projects = parseInt(maxProjects, 10);
      if (isNaN(projects) || projects < 0) return setError(t('admin.plans.form.errors.projects'));
    }
    let diagrams: number | null = null;
    if (!unlimitedDiagrams) {
      diagrams = parseInt(maxDiagrams, 10);
      if (isNaN(diagrams) || diagrams < 0) return setError(t('admin.plans.form.errors.diagrams'));
    }

    setLoading(true);
    try {
      if (plan) {
        const updateData: PlanUpdate = {
          name: name.trim(),
          description: description.trim() || undefined,
          max_projects: projects,
          max_diagrams: diagrams,
          is_active: isActive,
        };
        if (!isFreePlan) updateData.code = code.trim();
        if (!hasSubscribers) updateData.price_usd = price;
        await apiService.updatePlan(plan.id, updateData);
      } else {
        const additionalPrices: Record<string, number> = {};
        Object.entries(currencyPrices).forEach(([currency, amountStr]) => {
          const amount = parseFloat(amountStr);
          if (!isNaN(amount) && amount > 0) additionalPrices[currency] = amount;
        });
        const createData: PlanCreate = {
          name: name.trim(),
          code: code.trim(),
          description: description.trim() || undefined,
          price_usd: price,
          max_projects: projects,
          max_diagrams: diagrams,
          prices: Object.keys(additionalPrices).length > 0 ? additionalPrices : undefined,
        };
        await apiService.createPlan(createData);
      }
      onSuccess(name.trim());
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.plans.form.errors.save'));
    } finally {
      setLoading(false);
    }
  };

  const limitField = (
    id: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    unlimited: boolean,
    setUnlimited: (v: boolean) => void,
    placeholder: string,
  ) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        value={unlimited ? '' : value}
        onChange={(e) => setValue(e.target.value)}
        disabled={unlimited}
        placeholder={unlimited ? '∞' : placeholder}
        className="input"
      />
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
        {t('admin.plans.form.unlimited')}
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-xl w-full max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {plan ? t('admin.plans.form.editTitle', { name: plan.name }) : t('admin.plans.form.createTitle')}
          </h2>
          <button type="button" onClick={onClose} disabled={loading} className="btn btn-ghost btn-sm !px-2" aria-label={t('admin.plans.form.close')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0" noValidate>
          <div className="px-6 py-5 space-y-5 overflow-y-auto">
            {error && (
              <div role="alert" className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/60 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan-name" className={labelClass}>
                  {t('admin.plans.form.name')}
                </label>
                <input id="plan-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t('admin.plans.namePlaceholder')} required />
              </div>
              <div>
                <label htmlFor="plan-code" className={labelClass}>
                  {t('admin.plans.form.code')}
                </label>
                <input
                  id="plan-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  className="input font-mono"
                  placeholder={t('admin.plans.codePlaceholder')}
                  disabled={isFreePlan}
                  aria-describedby="plan-code-help"
                  required
                />
              </div>
            </div>
            <p id="plan-code-help" className={`${helpClass} -mt-3`}>
              {isFreePlan ? t('admin.plans.form.codeFreeLocked') : t('admin.plans.form.codeHelp')}
            </p>

            <div>
              <label htmlFor="plan-description" className={labelClass}>
                {t('admin.plans.form.description')}
              </label>
              <textarea
                id="plan-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="input h-auto py-2"
                placeholder={t('admin.plans.descriptionPlaceholder')}
              />
            </div>

            {/* Price */}
            <div>
              <label htmlFor="plan-price" className={labelClass}>
                {t('admin.plans.form.priceUsd')}
              </label>
              <div className="relative sm:max-w-[12rem]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
                  $
                </span>
                <input
                  id="plan-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  className="input pl-7 tabular-nums"
                  disabled={hasSubscribers}
                  aria-describedby="plan-price-help"
                />
              </div>
              <p id="plan-price-help" className={hasSubscribers ? 'mt-1 text-xs text-amber-700 dark:text-amber-400' : helpClass}>
                {hasSubscribers ? t('admin.plans.form.priceLocked') : t('admin.plans.form.priceHelp')}
              </p>
            </div>

            {/* Other currencies (new paid plans) */}
            {!plan && parseFloat(priceUsd) > 0 && (
              <fieldset>
                <legend className={labelClass}>{t('admin.plans.form.otherCurrencies')}</legend>
                <p className={`${helpClass} mt-0 mb-3`}>{t('admin.plans.form.otherCurrenciesHelp')}</p>
                <div className="space-y-2">
                  {Object.entries(currencyPrices).map(([currency, amount]) => (
                    <div key={currency} className="flex items-center gap-2">
                      <span className="w-6 text-base" aria-hidden="true">
                        {CURRENCY_FLAGS[currency] ?? ''}
                      </span>
                      <label htmlFor={`price-${currency}`} className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {currency.toUpperCase()}
                      </label>
                      <input
                        id={`price-${currency}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setCurrencyPrices((prev) => ({ ...prev, [currency]: e.target.value }))}
                        className="input flex-1 tabular-nums"
                        placeholder="0.00"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCurrencyPrices((prev) => {
                            const next = { ...prev };
                            delete next[currency];
                            return next;
                          })
                        }
                        className="btn btn-ghost btn-sm !px-2"
                        aria-label={t('admin.plans.form.removeCurrency', { currency: currency.toUpperCase() })}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {availableCurrencies.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                      className="input w-auto"
                      aria-label={t('admin.plans.prices.currency')}
                    >
                      <option value="">{t('admin.plans.selectCurrency')}</option>
                      {availableCurrencies.map((c) => (
                        <option key={c} value={c}>
                          {CURRENCY_FLAGS[c] ?? ''} {c.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!newCurrency}
                      onClick={() => {
                        setCurrencyPrices((prev) => ({ ...prev, [newCurrency]: '' }));
                        setNewCurrency('');
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      {t('admin.plans.form.addCurrency')}
                    </button>
                  </div>
                )}
              </fieldset>
            )}

            {/* Limits */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{t('admin.plans.form.limits')}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {limitField('plan-projects', t('admin.plans.form.maxProjects'), maxProjects, setMaxProjects, unlimitedProjects, setUnlimitedProjects, t('admin.plans.projectsPlaceholder'))}
                {limitField('plan-diagrams', t('admin.plans.form.maxDiagrams'), maxDiagrams, setMaxDiagrams, unlimitedDiagrams, setUnlimitedDiagrams, t('admin.plans.diagramsPlaceholder'))}
              </div>
            </fieldset>

            {/* Availability (existing paid plans) */}
            {plan && !isFreePlan && (
              <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div>
                  <p id="plan-status-label" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.plans.form.status')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isActive ? t('admin.plans.form.statusOn') : t('admin.plans.form.statusOff')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-labelledby="plan-status-label"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    isActive ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? t('admin.plans.form.saving') : plan ? t('admin.plans.form.save') : t('admin.plans.form.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
