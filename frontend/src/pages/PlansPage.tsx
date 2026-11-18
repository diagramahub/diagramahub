import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import PlanList from '../components/admin/PlanList';

export default function PlansPage() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-6 md:pt-10 sm:pb-10">
        <PlanList />
      </main>
    </div>
  );
}
