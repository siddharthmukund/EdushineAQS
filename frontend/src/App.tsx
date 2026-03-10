import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Dashboard } from './pages/Dashboard';
import { SingleAnalysis } from './pages/SingleAnalysis';
import { BatchAnalysis } from './pages/BatchAnalysis';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuthStore } from './stores/authStore';
import { authGetMe } from './services/api';

// Lazy-loaded protected pages (Settings, Admin)
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const AdminPage = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

// ---------------------------------------------------------------------------
// ProtectedRoute — redirects unauthenticated users to /login
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// OAuthCallback — handles /auth/callback redirect from the backend after OAuth
// ---------------------------------------------------------------------------
function OAuthCallback() {
  const { login } = useAuthStore();
  // Token is delivered in the URL fragment (#) so browsers never send it to servers
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('access_token');
  // MFA redirect uses query params (the temp_token is short-lived and not the full session)
  const query = new URLSearchParams(window.location.search);
  const mfaRequired = query.get('mfa_required') === 'true';
  const tempToken = query.get('temp_token');
  const errorCode = query.get('error');

  useEffect(() => {
    if (errorCode) {
      // Backend surfaced an error — bounce to login with a readable message
      window.location.replace(`/login?sso_error=${errorCode}`);
    } else if (mfaRequired && tempToken) {
      // User has MFA enabled — stash temp token and show MFA input on login page
      sessionStorage.setItem('mfa_temp_token', tempToken);
      window.location.replace('/login?mfa_pending=1');
    } else if (token) {
      authGetMe(token)
        .then(profile => {
          login(token, profile);
          window.location.replace('/');
        })
        .catch(() => window.location.replace('/login'));
    } else {
      window.location.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Signing you in…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TokenValidator — re-validates stored JWT once on app mount
// ---------------------------------------------------------------------------
function TokenValidator() {
  const { isAuthenticated, token, updateUser, logout } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated && token) {
      authGetMe()
        .then(profile => updateUser(profile))
        .catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// AppShell — shared Header + Footer wrapper (used by both guest & auth routes)
// ---------------------------------------------------------------------------
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow">{children}</main>
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-sm text-gray-500">
          <p>Academic CV Analyzer &copy; {new Date().getFullYear()}</p>
          <p className="flex items-center gap-1">Powered by Edushine</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protected layout — authenticated routes only (uses nested <Routes>)
// ---------------------------------------------------------------------------
function ProtectedLayout() {
  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/batch" element={<BatchAnalysis />} />
        <Route path="/candidate" element={<CandidateDashboard />} />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<div className="p-12 text-center text-gray-400 animate-pulse">Loading settings…</div>}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div className="p-12 text-center text-gray-400 animate-pulse">Loading admin panel…</div>}>
              <AdminPage />
            </Suspense>
          }
        />
        {/* Fallback for unknown protected paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------
function App() {
  return (
    <Router>
      <TokenValidator />
      <Routes>
        {/* Public auth pages — no Header */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />

        {/* Home page — publicly accessible (guest trial mode) */}
        <Route
          path="/"
          element={
            <AppShell>
              <SingleAnalysis />
            </AppShell>
          }
        />

        {/* All other routes require authentication */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
