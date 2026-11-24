import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Broadcast } from '@phosphor-icons/react';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { TravellerDashboard } from './pages/TravellerDashboard';

// Route-level code splitting for faster mobile loads
const JoinPage = lazy(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })));
const DiscoverTravellersPage = lazy(() =>
  import('./pages/DiscoverTravellersPage').then((m) => ({ default: m.DiscoverTravellersPage }))
);
const ActivityFormPage = lazy(() =>
  import('./pages/ActivityFormPage').then((m) => ({ default: m.ActivityFormPage }))
);
const ActivityDetailPage = lazy(() =>
  import('./pages/ActivityDetailPage').then((m) => ({ default: m.ActivityDetailPage }))
);
const MyActivitiesPage = lazy(() =>
  import('./pages/MyActivitiesPage').then((m) => ({ default: m.MyActivitiesPage }))
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const StaffLoginPage = lazy(() =>
  import('./pages/StaffLoginPage').then((m) => ({ default: m.StaffLoginPage }))
);
const StaffDashboardPage = lazy(() =>
  import('./pages/StaffDashboardPage').then((m) => ({ default: m.StaffDashboardPage }))
);
const ManagerDashboardPage = lazy(() =>
  import('./pages/ManagerDashboardPage').then((m) => ({ default: m.ManagerDashboardPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

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

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
