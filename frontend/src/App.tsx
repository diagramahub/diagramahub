import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import SidebarLayout from './components/SidebarLayout';
import InstallationGuard from './components/InstallationGuard';
import { PresentationProvider } from './contexts/PresentationContext';
import { lazyWithPreload, type PreloadableComponent } from './utils/lazyWithPreload';

// Route-level code splitting: each page is its own chunk, so e.g. the login
// screen no longer downloads the editor, Mermaid or the export libraries.
// lazyWithPreload (not React.lazy) so preloaded routes render without Suspense.
const LoginPage = lazyWithPreload(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithPreload(() => import('./pages/RegisterPage'));
const DashboardPage = lazyWithPreload(() => import('./pages/DashboardPage'));
const DiagramEditorPage = lazyWithPreload(() => import('./pages/DiagramEditorPage'));
const OnboardingWizardPage = lazyWithPreload(() => import('./pages/OnboardingWizardPage'));
const InstallationWizardPage = lazyWithPreload(() => import('./pages/InstallationWizardPage'));
const ProfilePage = lazyWithPreload(() => import('./pages/ProfilePage'));
const IntegrationsPage = lazyWithPreload(() => import('./pages/IntegrationsPage'));
const SettingsPage = lazyWithPreload(() => import('./pages/SettingsPage'));
const SubscriptionPage = lazyWithPreload(() => import('./pages/SubscriptionPage'));
const AdminPage = lazyWithPreload(() => import('./pages/AdminPage'));
const UserManagementPage = lazyWithPreload(() => import('./pages/UserManagementPage'));
const PlansPage = lazyWithPreload(() => import('./pages/PlansPage'));
const ProjectsPage = lazyWithPreload(() => import('./pages/ProjectsPage'));
const SharedDiagramPage = lazyWithPreload(() => import('./pages/SharedDiagramPage'));
const ForgotPasswordPage = lazyWithPreload(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithPreload(() => import('./pages/ResetPasswordPage'));
const MfaVerifyPage = lazyWithPreload(() => import('./pages/MfaVerifyPage'));
const OAuthCallbackPage = lazyWithPreload(() => import('./pages/OAuthCallbackPage'));
const NotFoundPage = lazyWithPreload(() => import('./pages/NotFoundPage'));
const AboutPage = lazyWithPreload(() => import('./pages/AboutPage'));

function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem('token');
  } catch {
    return false; // storage blocked (private mode)
  }
}

// Which page chunk each URL needs. Keep in sync with <Routes> below.
const ROUTE_CHUNKS: [RegExp, PreloadableComponent<object>][] = [
  [/^\/shared\//, SharedDiagramPage],
  [/^\/setup/, InstallationWizardPage],
  [/^\/login/, LoginPage],
  [/^\/register/, RegisterPage],
  [/^\/forgot-password/, ForgotPasswordPage],
  [/^\/reset-password/, ResetPasswordPage],
  [/^\/mfa-verify/, MfaVerifyPage],
  [/^\/oauth\/callback/, OAuthCallbackPage],
  [/^\/onboarding/, OnboardingWizardPage],
  [/^\/projects\/[^/]+/, DiagramEditorPage],
  [/^\/(dashboard\/?)?$/, DashboardPage],
  [/^\/projects-list/, ProjectsPage],
  [/^\/profile/, ProfilePage],
  [/^\/settings/, SettingsPage],
  [/^\/subscription/, SubscriptionPage],
  [/^\/integrations/, IntegrationsPage],
  [/^\/about/, AboutPage],
  [/^\/admin\/users/, UserManagementPage],
  [/^\/admin\/plans/, PlansPage],
  [/^\/admin\/?$/, AdminPage],
];

// Fetch the current route's chunk immediately — in parallel with the auth and
// installation checks that gate rendering — so it is usually ready by the time
// the route renders (no fallback, no Suspense reveal delay). Signed-in users
// also warm the main destinations shortly after the page has loaded.
if (typeof window !== 'undefined') {
  const path = window.location.pathname;
  ROUTE_CHUNKS.find(([pattern]) => pattern.test(path))?.[1].preload();
  if (!hasStoredSession()) {
    void LoginPage.preload(); // protected URLs redirect here without a session
  } else {
    const warm = () => {
      void DashboardPage.preload();
      void ProjectsPage.preload();
      void DiagramEditorPage.preload();
    };
    // Only after the current page has loaded and settled: evaluating the editor
    // chunk costs a few hundred ms of main thread, which must not delay the
    // page the user actually opened.
    const scheduleWarm = () =>
      setTimeout(() => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 5000 });
        else warm();
      }, 1500);
    if (document.readyState === 'complete') scheduleWarm();
    else window.addEventListener('load', scheduleWarm, { once: true });
  }
}

/** Shown while a route chunk loads (usually a few ms on a warm cache). */
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" role="status" aria-busy="true">
      <svg className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
