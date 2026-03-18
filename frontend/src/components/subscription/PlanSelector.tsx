import { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { Plan, Subscription } from '../../types/subscription';

interface PlanSelectorProps {
  currentSubscription: Subscription | null;
  onPlanSelected?: () => void;
}

export default function PlanSelector({ currentSubscription, onPlanSelected }: PlanSelectorProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingToPlan, setChangingToPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPlans();
      setPlans(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      setChangingToPlan(planId);
      const response = await apiService.initiateCheckout(planId);
      
      if (response.session_url) {
        // Redirect to Stripe checkout
        window.location.href = response.session_url;
      } else {
        // Free plan - reload to show updated subscription
        if (onPlanSelected) {
          onPlanSelected();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error changing plan');
      setChangingToPlan(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatLimit = (limit: number | null) => {
    if (limit === null || limit === -1) return 'Unlimited';
    return limit.toString();
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan.id === planId;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Available Plans</h2>
        <p className="mt-1 text-sm text-gray-600">Choose the plan that fits your needs</p>
      </div>

      {/* Plans Grid */}
      <div className="px-6 py-6">
        <div className="space-y-4">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id);
            const isChanging = changingToPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-lg border-2 p-6 transition-all flex items-center justify-between ${
                  isCurrent
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                }`}
              >
                {/* Left side - Plan info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="px-2 py-1 text-xs font-semibold bg-purple-500 text-white rounded">
                        Plan Actual
                      </span>
                    )}
                    {plan.is_free && !isCurrent && (
                      <span className="px-2 py-1 text-xs font-semibold bg-gray-500 text-white rounded">
                        GRATIS
                      </span>
                    )}
                  </div>

                  {/* Plan Description */}
                  {plan.description && (
                    <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                  )}

                  {/* Features */}
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 text-green-500 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">
                        {formatLimit(plan.max_projects)} proyecto{plan.max_projects !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 text-green-500 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700">
                        {formatLimit(plan.max_diagrams)} diagrama{plan.max_diagrams !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Price and action */}
                <div className="flex items-center gap-6 ml-6">
                  {/* Price */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatPrice(plan.price_usd)}
                    </div>
                    <div className="text-sm text-gray-600">/mes</div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || isChanging}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isChanging
                        ? 'bg-purple-400 text-white cursor-wait'
                        : 'bg-purple-600 text-white btn-glass hover:bg-purple-700'
                    }`}
                  >
                    {isCurrent
                      ? 'Plan Actual'
                      : isChanging
                      ? 'Procesando...'
                      : plan.is_free
                      ? 'Cambiar a Gratis'
                      : 'Seleccionar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
