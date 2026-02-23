import { useState } from 'react';
import Navbar from '../components/Navbar';
import SubscriptionCard from '../components/subscription/SubscriptionCard';
import UsageIndicator from '../components/subscription/UsageIndicator';
import PlanSelector from '../components/subscription/PlanSelector';
import apiService from '../services/api';
import { Subscription } from '../types/subscription';

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePlanSelected = () => {
    // Refresh all components after plan change
    setRefreshKey(prev => prev + 1);
  };

  const loadSubscription = async () => {
    try {
      const data = await apiService.getMySubscription();
      setSubscription(data);
    } catch (err) {
      console.error('Error loading subscription:', err);
    }
  };

  // Load subscription on mount
  useState(() => {
    loadSubscription();
  });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Subscription & Billing</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your subscription plan and monitor resource usage
            </p>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Current Subscription & Usage */}
            <div className="lg:col-span-1 space-y-6">
              <div key={`subscription-${refreshKey}`}>
                <SubscriptionCard />
              </div>
              <div key={`usage-${refreshKey}`}>
                <UsageIndicator />
              </div>
            </div>

            {/* Right Column - Plan Selector */}
            <div className="lg:col-span-2">
              <div key={`plans-${refreshKey}`}>
                <PlanSelector 
                  currentSubscription={subscription}
                  onPlanSelected={handlePlanSelected}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
