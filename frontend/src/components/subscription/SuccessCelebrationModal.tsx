import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

interface SuccessCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planPrice: number;
  maxProjects: number | null;
  maxDiagrams: number | null;
}

export default function SuccessCelebrationModal({
  isOpen,
  onClose,
  planName,
  planPrice,
  maxProjects,
  maxDiagrams
}: SuccessCelebrationModalProps) {
  const { t } = useTranslation();
  
  useEffect(() => {
    if (isOpen) {
      // Lanzar confeti cuando se abre el modal
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Confeti desde la izquierda
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Confeti desde la derecha
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
          {/* Icono de éxito con animación */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {/* Anillo dorado giratorio */}
              <div className="absolute inset-0 border-4 border-yellow-300 rounded-full animate-ping opacity-75"></div>
            </div>
          </div>

          {/* Título */}
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
            {t('subscription.celebration.title')}
          </h2>
          <p className="text-center text-gray-600 mb-6">
            {t('subscription.celebration.subtitle')}
          </p>

          {/* Plan Info Card */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 mb-6 border-2 border-yellow-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">{planName}</h3>
              <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                {t('subscription.plans.premium')}
              </span>
            </div>
            
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(planPrice)}
              </span>
              <span className="text-gray-600">{t('subscription.plans.perMonth')}</span>
            </div>

            {/* Beneficios */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('subscription.celebration.newBenefits')}</h4>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">
                  {maxProjects === null || maxProjects === -1
                    ? t('subscription.features.unlimitedProjects')
                    : t('subscription.features.upToProjects', { count: maxProjects })}
                </span>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">
                  {maxDiagrams === null || maxDiagrams === -1
                    ? t('subscription.features.unlimitedDiagrams')
                    : t('subscription.features.upToDiagrams', { count: maxDiagrams })}
                </span>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">
                  {t('subscription.features.premiumBadge')}
                </span>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">
                  {t('subscription.features.prioritySupport')}
                </span>
              </div>
            </div>
          </div>

          {/* Botón de cerrar */}
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-lg"
          >
            {t('subscription.celebration.startUsing')}
          </button>
        </div>
      </div>
    </div>
  );
}
