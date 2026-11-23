import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SignOut, ShieldCheck, CircleNotch, QrCode, SquaresFour } from '@phosphor-icons/react';
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
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/staff/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const homePath =
    user?.role === 'CENTRAL_ADMIN'
      ? '/admin'
      : user?.role === 'HOSTEL_MANAGER'
        ? '/manager'
        : '/staff';

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      <header className="no-print bg-[#14241E] text-white sticky top-0 z-20 shadow-sm border-b border-emerald-500/15">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={homePath}
              className="w-9 h-9 rounded-xl bg-white/10 border border-emerald-400/25 text-emerald-300 font-extrabold flex items-center justify-center text-xs shrink-0 hover:bg-white/15 transition"
            >
              CG
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-sm sm:text-base truncate">{title}</h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/20 shrink-0">
                  <ShieldCheck weight="fill" className="w-3 h-3" />
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
              {subtitle && (
                <p className="text-[11px] text-emerald-200/75 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user?.role === 'HOSTEL_MANAGER' && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
                <Link
                  to="/manager"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                    location.pathname === '/manager'
                      ? 'bg-white/15 text-emerald-300'
                      : 'text-emerald-100/80 hover:bg-white/10'
                  }`}
                >
                  <SquaresFour weight="duotone" className="w-3.5 h-3.5" />
                  Manager
                </Link>
                <Link
                  to="/staff"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                    location.pathname === '/staff'
                      ? 'bg-white/15 text-emerald-300'
                      : 'text-emerald-100/80 hover:bg-white/10'
                  }`}
                >
                  <QrCode weight="duotone" className="w-3.5 h-3.5" />
                  QR &amp; Code
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition active:scale-95 disabled:opacity-60"
            >
              {loggingOut ? (
                <CircleNotch className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SignOut weight="bold" className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
      <Footer />
    </div>
  );
}
