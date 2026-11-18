import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CreateProjectModal from '../components/CreateProjectModal';
import { takeReturnTo } from '../utils/returnTo';

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  // The modal calls onSuccess and then onClose: only the first one navigates.
  const left = useRef(false);
  const leave = (fallback: string) => {
    if (left.current) return;
    left.current = true;
    navigate(takeReturnTo(fallback));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      {/* Modal is rendered as an overlay */}
      <CreateProjectModal
        isOpen={true}
        onClose={() => leave('/dashboard')}
        onSuccess={(projectId: string) => leave(`/projects/${projectId}`)}
        isFirstProject={true}
      />
    </div>
  );
}
