import { useState } from 'react';
import apiService from '../../services/api';
import { Plan, PlanCreate, PlanUpdate, CURRENCY_FLAGS, SUPPORTED_CURRENCIES } from '../../types/subscription';

const NON_USD_CURRENCIES = SUPPORTED_CURRENCIES.filter(c => c !== 'usd');

interface PlanFormProps {
  plan: Plan | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlanForm({ plan, onClose, onSuccess }: PlanFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState(plan?.name || '');
  const [code, setCode] = useState(plan?.code || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [priceUsd, setPriceUsd] = useState(plan?.price_usd?.toString() || '0');
  const [maxProjects, setMaxProjects] = useState(plan?.max_projects?.toString() || '');
  const [maxDiagrams, setMaxDiagrams] = useState(plan?.max_diagrams?.toString() || '');
  const [unlimitedProjects, setUnlimitedProjects] = useState(plan?.max_projects === null || plan?.max_projects === -1);
  const [unlimitedDiagrams, setUnlimitedDiagrams] = useState(plan?.max_diagrams === null || plan?.max_diagrams === -1);
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);

  // Multi-currency prices state
  const [currencyPrices, setCurrencyPrices] = useState<Record<string, string>>(() => {
    const existing: Record<string, string> = {};
    if (plan?.prices) {
      Object.entries(plan.prices).forEach(([currency, amount]) => {
        if (currency !== 'usd') {
          existing[currency] = amount.toString();
        }
      });
    }
    return existing;
  });
  const [newCurrency, setNewCurrency] = useState('');

  const hasSubscribers = plan ? plan.active_subscriptions > 0 : false;
  const isFreePlan = plan?.is_free || false;
  const availableCurrencies = NON_USD_CURRENCIES.filter(c => !(c in currencyPrices));

  const handleCodeChange = (value: string) => {
    // Auto-format: uppercase, no spaces, only alphanumeric, hyphens and underscores
    setCode(value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre del plan es requerido');
      return;
    }

    if (!code.trim()) {
      setError('El código del plan es requerido');
      return;
    }

    const price = parseFloat(priceUsd);
    if (isNaN(price) || price < 0) {
      setError('El precio debe ser un número válido no negativo');
      return;
    }

    let projects: number | null = null;
    if (!unlimitedProjects) {
      projects = parseInt(maxProjects);
      if (isNaN(projects) || projects < 0) {
        setError('Máx. proyectos debe ser un número válido no negativo');
        return;
      }
    }

    let diagrams: number | null = null;
    if (!unlimitedDiagrams) {
      diagrams = parseInt(maxDiagrams);
      if (isNaN(diagrams) || diagrams < 0) {
        setError('Máx. diagramas debe ser un número válido no negativo');
        return;
      }
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
        if (!isFreePlan) {
          updateData.code = code.trim();
        }
        if (!hasSubscribers) {
          updateData.price_usd = price;
        }
        await apiService.updatePlan(plan.id, updateData);
      } else {
        // Build prices dict from currency inputs
        const additionalPrices: Record<string, number> = {};
        Object.entries(currencyPrices).forEach(([currency, amountStr]) => {
          const amt = parseFloat(amountStr);
          if (!isNaN(amt) && amt > 0) {
            additionalPrices[currency] = amt;
          }
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
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Error ${plan ? 'actualizando' : 'creando'} plan`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Plan Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Plan *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="ej: Pro, Enterprise"
            />
          </div>

          {/* Plan Code */}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Código *
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
              placeholder="ej: PRO, ENTERPRISE"
              disabled={isFreePlan}
            />
            <p className="mt-1 text-xs text-gray-500">
              {isFreePlan
                ? 'El código del plan gratuito no se puede cambiar'
                : 'Identificador único. Solo mayúsculas, números, guiones y guiones bajos'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Breve descripción de las características del plan"
            />
          </div>

          {/* Price */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Precio (USD/mes) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="0.00"
                disabled={hasSubscribers}
              />
            </div>
            {hasSubscribers && (
              <p className="mt-1 text-xs text-amber-600">
                No se puede cambiar el precio porque este plan tiene suscriptores activos
              </p>
            )}
          </div>

          {/* Multi-currency Prices */}
          {parseFloat(priceUsd) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precios en otras monedas
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Agrega precios en monedas adicionales. Stripe mostrará automáticamente el precio correcto según la ubicación del usuario.
              </p>

              {/* Currency price rows */}
              <div className="space-y-2">
                {Object.entries(currencyPrices).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center gap-2">
                    <span className="text-lg w-8">{CURRENCY_FLAGS[currency] ?? '🏳️'}</span>
                    <span className="text-sm font-medium text-gray-700 w-12">{currency.toUpperCase()}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setCurrencyPrices(prev => ({...prev, [currency]: e.target.value}))}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {...currencyPrices};
                        delete updated[currency];
                        setCurrencyPrices(updated);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add currency button */}
              {availableCurrencies.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar moneda...</option>
                    {availableCurrencies.map(c => (
                      <option key={c} value={c}>
                        {CURRENCY_FLAGS[c] ?? '🏳️'} {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!newCurrency}
                    onClick={() => {
                      if (newCurrency) {
                        setCurrencyPrices(prev => ({...prev, [newCurrency]: ''}));
                        setNewCurrency('');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar moneda
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Max Projects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Máx. Proyectos *
            </label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={unlimitedProjects}
                  onChange={(e) => setUnlimitedProjects(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Ilimitados</span>
              </label>
            </div>
            {!unlimitedProjects && (
              <input
                type="number"
                min="0"
                value={maxProjects}
                onChange={(e) => setMaxProjects(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="ej: 10"
              />
            )}
          </div>

          {/* Max Diagrams */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Máx. Diagramas *
            </label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={unlimitedDiagrams}
                  onChange={(e) => setUnlimitedDiagrams(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Ilimitados</span>
              </label>
            </div>
            {!unlimitedDiagrams && (
              <input
                type="number"
                min="0"
                value={maxDiagrams}
                onChange={(e) => setMaxDiagrams(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="ej: 100"
              />
            )}
          </div>

          {/* Status (only in edit mode, not for free plan) */}
          {plan && !isFreePlan && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Estado del plan</p>
                <p className="text-xs text-gray-500">
                  {isActive ? 'Los usuarios pueden suscribirse a este plan' : 'Este plan no está disponible para nuevas suscripciones'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Guardando...' : plan ? 'Actualizar Plan' : 'Crear Plan'}
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
