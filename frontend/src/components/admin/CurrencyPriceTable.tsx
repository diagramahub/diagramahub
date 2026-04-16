import { useState } from 'react';
import apiService from '../../services/api';
import { Plan } from '../../types/subscription';
import { CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';
import CurrencyPriceForm from './CurrencyPriceForm';
import ConfirmModal from '../ConfirmModal';

interface CurrencyPriceTableProps {
  plan: Plan;
  onPriceChanged: () => void;
}

export default function CurrencyPriceTable({ plan, onPriceChanged }: CurrencyPriceTableProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingCurrency, setDeletingCurrency] = useState<string | null>(null);

  const priceEntries = Object.entries(plan.prices ?? {});
  const allCurrenciesConfigured = priceEntries.length >= SUPPORTED_CURRENCIES.length;

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const handleDelete = async () => {
    if (!deletingCurrency) return;
    try {
      await apiService.removePlanPrice(plan.id, deletingCurrency);
      setDeletingCurrency(null);
      onPriceChanged();
    } catch (err: any) {
      console.error('Error removing price:', err);
      setDeletingCurrency(null);
    }
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    onPriceChanged();
  };

  if (priceEntries.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No hay precios configurados
      </div>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="pb-1 pr-2 w-8"></th>
            <th className="pb-1 pr-3">Moneda</th>
            <th className="pb-1 pr-3">Monto/mes</th>
            <th className="pb-1 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {priceEntries.map(([currency, amount]) => (
            <tr key={currency} className="border-t border-gray-100">
              <td className="py-1.5 pr-2">
                {CURRENCY_FLAGS[currency] ?? '🏳️'}
              </td>
              <td className="py-1.5 pr-3 font-medium text-gray-900">
                {currency.toUpperCase()}
              </td>
              <td className="py-1.5 pr-3 text-gray-700">
                {formatAmount(amount, currency)}
              </td>
              <td className="py-1.5">
                {currency !== 'usd' && (
                  <button
                    onClick={() => setDeletingCurrency(currency)}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                    title={`Eliminar precio ${currency.toUpperCase()}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={() => setShowAddModal(true)}
        disabled={allCurrenciesConfigured}
        className="mt-2 px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar moneda
      </button>

      {showAddModal && (
        <CurrencyPriceForm
          plan={plan}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      <ConfirmModal
        isOpen={!!deletingCurrency}
        onClose={() => setDeletingCurrency(null)}
        onConfirm={handleDelete}
        title="Eliminar precio"
        message={`¿Estás seguro de eliminar el precio en ${deletingCurrency?.toUpperCase() ?? ''}? El precio se desactivará en Stripe.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
      />
    </div>
  );
}
