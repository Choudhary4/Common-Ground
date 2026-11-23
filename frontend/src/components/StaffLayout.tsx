import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Footer } from './Footer';

export function StaffLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <header className="no-print bg-white border-b border-amber-200/80 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={
                user?.role === 'CENTRAL_ADMIN'
                  ? '/admin'
                  : user?.role === 'HOSTEL_MANAGER'
                    ? '/manager'
                    : '/staff'
              }
              className="w-9 h-9 rounded-xl bg-[#E85D3F] text-white font-bold flex items-center justify-center text-sm"
            >
              CG
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg">{title}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900">
                  <ShieldCheck className="w-3 h-3" />
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'HOSTEL_MANAGER' && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium">
                <Link
                  to="/manager"
                  className="px-3 py-1.5 rounded-lg hover:bg-amber-50 text-slate-700"
                >
                  Manager
                </Link>
                <Link
                  to="/staff"
                  className="px-3 py-1.5 rounded-lg hover:bg-amber-50 text-slate-700"
                >
                  QR & Access Code
                </Link>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
      <Footer />
    </div>
  );
}
