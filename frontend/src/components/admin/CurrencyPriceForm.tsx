import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { Plan, CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';
import { apiErrorMessage } from '../../utils/apiError';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface CurrencyPriceFormProps {
  plan: Plan;
  onClose: () => void;
  onSuccess: () => void;
}

/** Add a plan's monthly price in another currency. */
export default function CurrencyPriceForm({ plan, onClose, onSuccess }: CurrencyPriceFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useDialogA11y(true, onClose, !loading);

  const configured = Object.keys(plan.prices ?? {});
  const availableCurrencies = SUPPORTED_CURRENCIES.filter((c) => c !== 'usd' && !configured.includes(c));
  const [currency, setCurrency] = useState(availableCurrencies[0] ?? '');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currency) return setError(t('admin.plans.prices.errors.currency'));
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return setError(t('admin.plans.prices.errors.amount'));

    setLoading(true);
    try {
      await apiService.addPlanPrice(plan.id, { currency, amount: parsed });
      onSuccess();
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.plans.prices.errors.add'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="currency-price-title"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-w-sm w-full"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 id="currency-price-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('admin.plans.prices.title')}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{plan.name}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div role="alert" className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/60 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.plans.prices.currency')}
                </label>
                <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
                  {availableCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_FLAGS[c] ?? ''} {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.plans.prices.amount')}
                </label>
                <input id="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input tabular-nums" placeholder="0.00" />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading || availableCurrencies.length === 0} className="btn btn-primary">
              {loading ? t('admin.plans.prices.adding') : t('admin.plans.prices.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
