import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiService from '../services/api';

interface InstallationGuardProps {
  children: React.ReactNode;
}

export default function InstallationGuard({ children }: InstallationGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const checkInstallation = async () => {
      // Don't check if we're already on the setup page
      if (location.pathname === '/setup') {
        setChecking(false);
        return;
      }

      try {
        const status = await apiService.checkInstallationStatus();

        if (status.needs_setup) {
          setNeedsSetup(true);
          navigate('/setup', { replace: true });
        } else {
          setNeedsSetup(false);
        }
      } catch (error) {
        console.error('Error checking installation status:', error);
        // If the endpoint fails, assume installation is complete
        setNeedsSetup(false);
      } finally {
        setChecking(false);
      }
    };

    checkInstallation();
  }, [location.pathname, navigate]);

  // Show loading state while checking
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Cargando DiagramaHub...</h2>
        </div>
      </div>
    );
  }

  // If on setup page or setup not needed, render children
  if (location.pathname === '/setup' || !needsSetup) {
    return <>{children}</>;
  }

  // Don't render anything while redirecting to setup
  return null;
}
