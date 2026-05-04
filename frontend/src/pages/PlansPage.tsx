import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import PlanList from '../components/admin/PlanList';

export default function PlansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('sidebar.plans')}
          </h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('sidebar.plansDescription')}
          </p>
        </div>
        <PlanList />
      </main>
    </div>
  );
}
