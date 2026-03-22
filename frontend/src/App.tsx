import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DiagramEditorPage from './pages/DiagramEditorPage';
import OnboardingWizardPage from './pages/OnboardingWizardPage';
import InstallationWizardPage from './pages/InstallationWizardPage';
import ProfilePage from './pages/ProfilePage';
import SharedDiagramPage from './pages/SharedDiagramPage';
import InstallationGuard from './components/InstallationGuard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route — no AuthProvider, no PrivateRoute */}
        <Route path="/shared/:token" element={<SharedDiagramPage />} />

        {/* All other routes wrapped in AuthProvider */}
        <Route
          path="*"
          element={
            <AuthProvider>
              <InstallationGuard>
                <Routes>
                  <Route path="/setup" element={<InstallationWizardPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route
                    path="/onboarding"
                    element={
                      <PrivateRoute>
                        <OnboardingWizardPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <DashboardPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId"
                    element={
                      <PrivateRoute>
                        <DiagramEditorPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId/diagrams/:diagramId"
                    element={
                      <PrivateRoute>
                        <DiagramEditorPage />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <ProfilePage />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </InstallationGuard>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
