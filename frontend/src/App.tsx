import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { JoinPage } from './pages/JoinPage';
import { TravellerDashboard } from './pages/TravellerDashboard';
import { DiscoverTravellersPage } from './pages/DiscoverTravellersPage';
import { ActivityFormPage } from './pages/ActivityFormPage';
import { ActivityDetailPage } from './pages/ActivityDetailPage';
import { MyActivitiesPage } from './pages/MyActivitiesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';
import { ManagerDashboardPage } from './pages/ManagerDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-sm text-slate-500">
        Loading...
      </div>
    );
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
