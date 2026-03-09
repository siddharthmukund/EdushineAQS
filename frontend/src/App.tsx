import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Dashboard } from './pages/Dashboard';
import { SingleAnalysis } from './pages/SingleAnalysis';
import { BatchAnalysis } from './pages/BatchAnalysis';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { AppMarketplace } from './pages/AppMarketplace';
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
// OAuthCallback — handles /auth/callback redirect from OAuth provider
// ---------------------------------------------------------------------------
function OAuthCallback() {
  const { login } = useAuthStore();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('access_token');

  useEffect(() => {
    if (token) {
      authGetMe()
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
// Protected layout (with Header + Footer)
// ---------------------------------------------------------------------------
function ProtectedLayout() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<SingleAnalysis />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/batch" element={<BatchAnalysis />} />
          <Route path="/candidate" element={<CandidateDashboard />} />
          <Route path="/marketplace" element={<AppMarketplace />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-sm text-gray-500">
          <p>Academic CV Analyzer &copy; {new Date().getFullYear()}</p>
          <p className="flex items-center gap-1">Powered by Claude 3.5 Sonnet</p>
        </div>
      </footer>
    </div>
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
        {/* Public routes — no Header */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />

        {/* All other routes are protected */}
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
