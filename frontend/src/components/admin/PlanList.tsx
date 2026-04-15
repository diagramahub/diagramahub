import { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { Plan } from '../../types/subscription';
import PlanForm from './PlanForm';
import CurrencyPriceTable from './CurrencyPriceTable';
import ConfirmModal from '../ConfirmModal';

export default function PlanList() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAllPlans();
      setPlans(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowCreateModal(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setShowCreateModal(true);
  };

  const handleDeactivatePlan = async () => {
    if (!deactivatingPlan) return;

    try {
      await apiService.deactivatePlan(deactivatingPlan.id);
      setSuccess(`Plan "${deactivatingPlan.name}" deactivated successfully`);
      setDeactivatingPlan(null);
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error deactivating plan');
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;

    try {
      await apiService.deactivatePlan(deletingPlan.id);
      setSuccess(`Plan "${deletingPlan.name}" eliminado exitosamente`);
      setDeletingPlan(null);
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error eliminando plan');
      setDeletingPlan(null);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    const newActive = !plan.is_active;
    // Si va a desactivar, pedir confirmación
    if (!newActive) {
      setDeactivatingPlan(plan);
      return;
    }
    try {
      setTogglingPlanId(plan.id);
      await apiService.updatePlan(plan.id, { is_active: true });
      setSuccess(`Plan "${plan.name}" activado`);
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error activando plan');
    } finally {
      setTogglingPlanId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowCreateModal(false);
    setEditingPlan(null);
    setSuccess(editingPlan ? 'Plan updated successfully' : 'Plan created successfully');
    loadPlans();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null || limit === -1) {
      return 'Unlimited';
    }
    return limit.toString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage subscription plans and pricing
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="px-4 py-2 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Plan
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Plans Cards */}
      <div className="grid gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4">
              {/* Plan info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  {plan.code && (
                    <code className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded font-mono">{plan.code}</code>
                  )}
                  {plan.is_free && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">FREE</span>
                  )}
                  {plan.is_active ? (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Activo</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">Inactivo</span>
                  )}
                  {!plan.is_free && plan.price_usd > 0 && (
                    plan.stripe_product_id && (plan.stripe_prices?.length ?? 0) > 0 ? (
                      <span 
                        className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded flex items-center gap-1 cursor-help"
                        title={`Stripe Product: ${plan.stripe_product_id}`}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Stripe
                      </span>
                    ) : (
                      <span 
                        className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded flex items-center gap-1 cursor-help"
                        title="Plan no sincronizado con Stripe"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Sin Stripe
                      </span>
                    )
                  )}
                </div>
                {plan.description && (
                  <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  {(plan.is_free || plan.price_usd === 0) && (
                    <span>Precio: <span className="font-medium text-gray-900">{formatPrice(plan.price_usd)}/mes</span></span>
                  )}
                  <span>Proyectos: <span className="font-medium text-gray-900">{formatLimit(plan.max_projects)}</span></span>
                  <span>Diagramas: <span className="font-medium text-gray-900">{formatLimit(plan.max_diagrams)}</span></span>
                  <span>Suscriptores: <span className="font-medium text-gray-900">{plan.active_subscriptions}</span></span>
                </div>
                {!plan.is_free && plan.price_usd > 0 && (
                  <div className="mt-3">
                    <CurrencyPriceTable plan={plan} onPriceChanged={loadPlans} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {!plan.is_free && (
                  <button
                    type="button"
                    disabled={togglingPlanId === plan.id}
                    onClick={() => handleToggleActive(plan)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${plan.is_active ? 'bg-green-500' : 'bg-gray-300'} ${togglingPlanId === plan.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    title={plan.is_active ? 'Desactivar plan' : 'Activar plan'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${plan.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                )}
                <button
                  onClick={() => handleEditPlan(plan)}
                  className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  Editar
                </button>
                {!plan.is_free && plan.active_subscriptions === 0 && (
                  <button
                    onClick={() => setDeletingPlan(plan)}
                    className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    title="Eliminar plan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay planes</h3>
            <p className="mt-1 text-sm text-gray-500">Comienza creando un nuevo plan.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <PlanForm
          plan={editingPlan}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPlan(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deactivatingPlan}
        onClose={() => setDeactivatingPlan(null)}
        onConfirm={handleDeactivatePlan}
        title="Desactivar Plan"
        message={`¿Desactivar el plan "${deactivatingPlan?.name}"? Las suscripciones existentes se mantendrán activas, pero nuevos usuarios no podrán suscribirse. El producto se archivará en Stripe.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        isDangerous={true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDeletePlan}
        title="Eliminar Plan"
        message={`¿Estás seguro de eliminar el plan "${deletingPlan?.name}"? Esta acción eliminará el plan de la base de datos y de Stripe. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
      />
    </div>
  );
}
