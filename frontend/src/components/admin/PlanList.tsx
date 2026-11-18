import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import apiService from '../../services/api';
import { Plan } from '../../types/subscription';
import PlanForm from './PlanForm';
import { PlanCard } from './PlanCard';
import ConfirmModal from '../ConfirmModal';
import EmptyState from '../EmptyState';
import Skeleton from '../Skeleton';
import { apiErrorMessage } from '../../utils/apiError';
import { plansSummary, sortPlans } from '../../utils/plans';

type Notice = { kind: 'success' | 'error'; text: string };

/** Admin plans: summary, one card per plan, create/edit/offer/delete. */
export default function PlanList() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formPlan, setFormPlan] = useState<Plan | null | undefined>(undefined); // undefined = closed, null = new
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setPlans(await apiService.getAllPlans());
    } catch (err: unknown) {
      setNotice({ kind: 'error', text: apiErrorMessage(err) || t('admin.plans.messages.loadError') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Confirmations fade out; errors stay until dismissed.
  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const run = async (plan: Plan, action: () => Promise<unknown>, successKey: string) => {
    setBusyPlanId(plan.id);
    try {
      await action();
      setNotice({ kind: 'success', text: t(`admin.plans.messages.${successKey}`, { name: plan.name }) });
      await loadPlans();
    } catch (err: unknown) {
      setNotice({ kind: 'error', text: apiErrorMessage(err) || t('admin.plans.messages.actionError') });
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleToggleOffered = (plan: Plan) => {
    if (plan.is_active) {
      setDeactivatingPlan(plan); // asks first
    } else {
      run(plan, () => apiService.updatePlan(plan.id, { is_active: true }), 'activated');
    }
  };

  const summary = plansSummary(plans);
  const sorted = sortPlans(plans);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t('sidebar.plans')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('sidebar.plansDescription')}</p>
        </div>
        <button type="button" onClick={() => setFormPlan(null)} className="btn btn-primary self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('admin.plans.create')}
        </button>
      </div>

      {/* Notices */}
      <div aria-live="polite">
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
              notice.kind === 'success'
                ? 'border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300'
                : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="flex-shrink-0 opacity-70 hover:opacity-100"
              aria-label={t('admin.plans.messages.dismiss')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="card" height="h-20" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="card" height="h-72" />
            ))}
          </div>
        </div>
      ) : plans.length === 0 ? (
        <div className="card">
          <EmptyState
            title={t('admin.plans.empty.title')}
            description={t('admin.plans.empty.description')}
            actionLabel={t('admin.plans.create')}
            onAction={() => setFormPlan(null)}
          />
        </div>
      ) : (
        <>
          {/* Summary */}
          <dl className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            {[
              { label: t('admin.plans.summary.activePlans'), value: t('admin.plans.summary.activeOf', { active: summary.active, total: summary.total }) },
              { label: t('admin.plans.summary.subscribers'), value: String(summary.subscribers) },
              { label: t('admin.plans.summary.paidPlans'), value: String(summary.paidActive) },
            ].map((stat) => (
              <div key={stat.label} className="card px-3 py-2.5 sm:px-4 sm:py-3">
                <dt className="text-[11px] sm:text-xs font-medium leading-tight text-gray-500 dark:text-gray-400">{stat.label}</dt>
                <dd className="mt-1 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {summary.withoutGateway.length > 0 && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
              <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                {t('admin.plans.gatewayWarning', {
                  count: summary.withoutGateway.length,
                  names: summary.withoutGateway.map((p) => `«${p.name}»`).join(', '),
                })}
              </p>
              <Link to="/integrations" className="btn btn-secondary btn-sm self-start sm:self-auto">
                {t('admin.plans.gatewayWarningAction')}
              </Link>
            </div>
          )}

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                busy={busyPlanId === plan.id}
                onEdit={() => setFormPlan(plan)}
                onToggleOffered={() => handleToggleOffered(plan)}
                onDelete={() => setDeletingPlan(plan)}
                onPricesChanged={loadPlans}
              />
            ))}
          </div>
        </>
      )}

      {formPlan !== undefined && (
        <PlanForm
          plan={formPlan}
          onClose={() => setFormPlan(undefined)}
          onSuccess={(saved) => {
            setFormPlan(undefined);
            setNotice({ kind: 'success', text: t(`admin.plans.messages.${formPlan ? 'updated' : 'created'}`, { name: saved }) });
            loadPlans();
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!deactivatingPlan}
        onClose={() => setDeactivatingPlan(null)}
        onConfirm={() => {
          const plan = deactivatingPlan;
          setDeactivatingPlan(null);
          // Only stops offering it: the plan and its subscriptions stay.
          if (plan) run(plan, () => apiService.updatePlan(plan.id, { is_active: false }), 'deactivated');
        }}
        title={t('admin.plans.deactivate')}
        message={t('admin.plans.deactivateConfirm', { name: deactivatingPlan?.name })}
        confirmText={t('admin.plans.deactivateAction')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={() => {
          const plan = deletingPlan;
          setDeletingPlan(null);
          if (plan) run(plan, () => apiService.deletePlan(plan.id), 'deleted');
        }}
        title={t('admin.plans.delete')}
        message={t('admin.plans.deleteConfirm', { name: deletingPlan?.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  );
}
