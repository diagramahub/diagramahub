import { useState } from 'react';
import apiService from '../../services/api';
import { Plan, CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';

interface CurrencyPriceFormProps {
  plan: Plan;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CurrencyPriceForm({ plan, onClose, onSuccess }: CurrencyPriceFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const configuredCurrencies = (plan.stripe_prices ?? []).map((p) => p.currency);
  const availableCurrencies = SUPPORTED_CURRENCIES.filter(
    (c) => c !== 'usd' && !configuredCurrencies.includes(c)
  );

  const [currency, setCurrency] = useState(availableCurrencies[0] ?? '');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currency) {
      setError('Selecciona una moneda');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser un número mayor a 0');
      return;
    }

    setLoading(true);
    try {
      await apiService.addPlanPrice(plan.id, { currency, amount: parsedAmount });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al agregar precio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Agregar precio en moneda
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Currency select */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
              Moneda
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_FLAGS[c] ?? ''} {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Amount input */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Monto (por mes)
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || availableCurrencies.length === 0}
              className="flex-1 px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Guardando...' : 'Agregar precio'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
