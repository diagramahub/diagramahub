import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CreateProjectModal from '../components/CreateProjectModal';

export default function OnboardingWizardPage() {
  const navigate = useNavigate();

  const handleProjectCreated = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navbar />

      {/* Modal is rendered as an overlay */}
      <CreateProjectModal
        isOpen={true}
        onClose={() => navigate('/dashboard')}
        onSuccess={handleProjectCreated}
        isFirstProject={true}
      />
    </div>
  );
}
