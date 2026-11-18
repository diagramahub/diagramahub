import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { Plan, CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';
import CurrencyPriceForm from './CurrencyPriceForm';
import ConfirmModal from '../ConfirmModal';
import { apiErrorMessage } from '../../utils/apiError';
import { dateLocale } from '../../utils/locale';
import { formatAmount } from '../../utils/plans';

interface CurrencyPriceTableProps {
  plan: Plan;
  onPriceChanged: () => void;
}

/** A paid plan's monthly price per currency (USD is the base and stays). */
export default function CurrencyPriceTable({ plan, onPriceChanged }: CurrencyPriceTableProps) {
  const { t, i18n } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingCurrency, setDeletingCurrency] = useState<string | null>(null);
  const [error, setError] = useState('');
  const locale = dateLocale(i18n.language);

  const priceEntries = Object.entries(plan.prices ?? {});
  const allCurrenciesConfigured = SUPPORTED_CURRENCIES.every((c) => c === 'usd' || c in (plan.prices ?? {}));

  const handleDelete = async () => {
    if (!deletingCurrency) return;
    try {
      await apiService.removePlanPrice(plan.id, deletingCurrency);
      setError('');
      onPriceChanged();
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.plans.prices.errors.remove'));
    } finally {
      setDeletingCurrency(null);
    }
  };

  return (
    <div>
      {priceEntries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.plans.prices.none')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th scope="col" className="pb-1 pr-3 font-medium">{t('admin.plans.prices.currency')}</th>
              <th scope="col" className="pb-1 pr-3 font-medium text-right">{t('admin.plans.prices.amountPerMonth')}</th>
              <th scope="col" className="pb-1 w-8"><span className="sr-only">{t('common.delete')}</span></th>
            </tr>
          </thead>
          <tbody>
            {priceEntries.map(([currency, amount]) => (
              <tr key={currency} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1.5 pr-3 font-medium text-gray-900 dark:text-gray-100">
                  <span className="mr-1.5" aria-hidden="true">{CURRENCY_FLAGS[currency] ?? ''}</span>
                  {currency.toUpperCase()}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatAmount(amount, currency, locale)}</td>
                <td className="py-1 text-right">
                  {currency !== 'usd' && (
                    <button
                      type="button"
                      onClick={() => setDeletingCurrency(currency)}
                      className="btn btn-ghost btn-sm !px-1.5 text-red-600 dark:text-red-400"
                      aria-label={t('admin.plans.prices.remove', { currency: currency.toUpperCase() })}
                      title={t('admin.plans.prices.remove', { currency: currency.toUpperCase() })}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {!allCurrenciesConfigured && (
        <button type="button" onClick={() => setShowAddModal(true)} className="btn btn-secondary btn-sm mt-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('admin.plans.form.addCurrency')}
        </button>
      )}

      {showAddModal && (
        <CurrencyPriceForm
          plan={plan}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onPriceChanged();
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deletingCurrency}
        onClose={() => setDeletingCurrency(null)}
        onConfirm={handleDelete}
        title={t('admin.plans.deletePrice')}
        message={t('admin.plans.deletePriceConfirm', { currency: deletingCurrency?.toUpperCase() ?? '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  );
}
