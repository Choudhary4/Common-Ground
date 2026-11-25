import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Broadcast } from '@phosphor-icons/react';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { TravellerDashboard } from './pages/TravellerDashboard';

// Route-level code splitting with auto-reload fallback when a new Vercel deploy invalidates old chunks
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem('cg_chunk_reload');
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem('cg_chunk_reload')) {
        sessionStorage.setItem('cg_chunk_reload', '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

const JoinPage = lazyWithRetry(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })));
const DiscoverTravellersPage = lazyWithRetry(() =>
  import('./pages/DiscoverTravellersPage').then((m) => ({ default: m.DiscoverTravellersPage }))
);
const ActivityFormPage = lazyWithRetry(() =>
  import('./pages/ActivityFormPage').then((m) => ({ default: m.ActivityFormPage }))
);
const ActivityDetailPage = lazyWithRetry(() =>
  import('./pages/ActivityDetailPage').then((m) => ({ default: m.ActivityDetailPage }))
);
const MyActivitiesPage = lazyWithRetry(() =>
  import('./pages/MyActivitiesPage').then((m) => ({ default: m.MyActivitiesPage }))
);
const NotificationsPage = lazyWithRetry(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazyWithRetry(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ChatPage = lazyWithRetry(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const StaffLoginPage = lazyWithRetry(() =>
  import('./pages/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage }))
);
const StaffDashboardPage = lazyWithRetry(() =>
  import('./pages/StaffDashboardPage').then((m) => ({ default: m.StaffDashboardPage }))
);
const ManagerDashboardPage = lazyWithRetry(() =>
  import('./pages/ManagerDashboardPage').then((m) => ({ default: m.ManagerDashboardPage }))
);
const AdminDashboardPage = lazyWithRetry(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f9f9ff] px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#14241E] text-emerald-300 flex items-center justify-center shadow-md">
            <Broadcast weight="duotone" className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#111c2d]">App Updated</h2>
            <p className="text-xs text-[#59413c] mt-1">
              A fresh version was just deployed. Tap below to reload.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold shadow-xs"
          >
            Refresh Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RadarLoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f9f9ff] px-6 text-center select-none">
      <div className="relative flex items-center justify-center mb-6">
        <span className="absolute w-24 h-24 rounded-full bg-emerald-400/20 animate-ping" />
        <span className="absolute w-20 h-20 rounded-full bg-[#14241E]/10 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-[#14241E] text-emerald-300 flex items-center justify-center shadow-lg border border-emerald-400/25">
          <Broadcast weight="duotone" className="w-8 h-8" />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14241E] text-white text-[11px] font-extrabold tracking-wider uppercase shadow-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>GOSTOPS</span>
        <span className="text-emerald-400">×</span>
        <span>COMMON GROUND</span>
      </div>

      <p className="mt-3 text-xs font-semibold text-[#59413c]">
        Tuning into your hostel radar...
      </p>

      <div className="mt-5 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#a93017] animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-[#a93017]/80 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-[#14241E] animate-bounce" />
      </div>
    </div>
  );
}

function ProtectedRoute({
  allowedRoles,
  redirectTo = '/',
  children,
}: {
  allowedRoles: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <RadarLoadingScreen />;
  }
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}

function PwaBackHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx === 0 && location.pathname.startsWith('/app/')) {
      seededRef.current = true;
      const target = `${location.pathname}${location.search}${location.hash}`;
      navigate('/app', { replace: true });
      if (location.pathname.startsWith('/app/chat/')) {
        setTimeout(() => navigate('/app/chat'), 0);
        setTimeout(() => navigate(target), 15);
      } else {
        setTimeout(() => navigate(target), 0);
      }
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PwaBackHandler />
        <RouteErrorBoundary>
          <Suspense fallback={<RadarLoadingScreen />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="/staff/login" element={<StaffLoginPage />} />

            {/* Traveller Routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <TravellerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/discover"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <DiscoverTravellersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/activities/new"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <ActivityFormPage mode="create" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/activities/:id"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <ActivityDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/activities/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <ActivityFormPage mode="edit" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/my-activities"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <MyActivitiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/notifications"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/settings"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/chat"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/chat/:roomId"
              element={
                <ProtectedRoute allowedRoles={['TRAVELLER', 'HOSTEL_MANAGER']}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />

            {/* Staff / Manager / Admin Routes */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute
                  allowedRoles={['HOSTEL_STAFF', 'HOSTEL_MANAGER']}
                  redirectTo="/staff/login"
                >
                  <StaffDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={['HOSTEL_MANAGER']} redirectTo="/staff/login">
                  <ManagerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['CENTRAL_ADMIN']} redirectTo="/staff/login">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
