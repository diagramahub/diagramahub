import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import SidebarLayout from './components/SidebarLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DiagramEditorPage from './pages/DiagramEditorPage';
import OnboardingWizardPage from './pages/OnboardingWizardPage';
import InstallationWizardPage from './pages/InstallationWizardPage';
import ProfilePage from './pages/ProfilePage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import AdminPage from './pages/AdminPage';
import UserManagementPage from './pages/UserManagementPage';
import PlansPage from './pages/PlansPage';
import ProjectsPage from './pages/ProjectsPage';
import SharedDiagramPage from './pages/SharedDiagramPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MfaVerifyPage from './pages/MfaVerifyPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import NotFoundPage from './pages/NotFoundPage';
import AboutPage from './pages/AboutPage';
import InstallationGuard from './components/InstallationGuard';
import { PresentationProvider } from './contexts/PresentationContext';

function App() {
  return (
    <ThemeProvider>
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
                  {/* Auth pages — no Sidebar */}
                  <Route path="/setup" element={<InstallationWizardPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/mfa-verify" element={<MfaVerifyPage />} />
                  <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

                  {/* Onboarding — no Sidebar */}
                  <Route
                    path="/onboarding"
                    element={
                      <PrivateRoute>
                        <OnboardingWizardPage />
                      </PrivateRoute>
                    }
                  />

                  {/* Editor Portal routes — with Sidebar + PresentationProvider */}
                  <Route
                    path="/projects/:projectId"
                    element={
                      <PrivateRoute>
                        <PresentationProvider>
                          <SidebarLayout>
                            <DiagramEditorPage />
                          </SidebarLayout>
                        </PresentationProvider>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId/diagrams/:diagramId"
                    element={
                      <PrivateRoute>
                        <PresentationProvider>
                          <SidebarLayout>
                            <DiagramEditorPage />
                          </SidebarLayout>
                        </PresentationProvider>
                      </PrivateRoute>
                    }
                  />

                  {/* Authenticated routes with Sidebar */}
                  <Route
                    path="/dashboard"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <DashboardPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/projects-list"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <ProjectsPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <ProfilePage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <SettingsPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/subscription"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <SubscriptionPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/integrations"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <IntegrationsPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/about"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <AboutPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <AdminPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <UserManagementPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin/plans"
                    element={
                      <PrivateRoute>
                        <SidebarLayout>
                          <PlansPage />
                        </SidebarLayout>
                      </PrivateRoute>
                    }
                  />

                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </InstallationGuard>
            </AuthProvider>
          }
        />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
