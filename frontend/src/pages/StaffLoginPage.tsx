import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  Eye,
  EyeSlash,
  CircleNotch,
  EnvelopeSimple,
  LockKey,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth, type UserRole } from '../context/AuthContext';
import { Footer } from '../components/Footer';

export function StaffLoginPage() {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ user: { role: UserRole } }>('/auth/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await refreshAuth();
      if (res.user.role === 'CENTRAL_ADMIN') navigate('/admin');
      else if (res.user.role === 'HOSTEL_MANAGER') navigate('/manager');
      else navigate('/staff');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#59413c] hover:text-[#111c2d] transition"
          >
            <ArrowLeft weight="bold" className="w-3.5 h-3.5" />
            Back to Common Ground
          </Link>

          <div className="bg-white rounded-[2rem] border border-[#e0bfb8]/35 shadow-sm overflow-hidden">
            {/* Dark Emerald Portal Header */}
            <div className="bg-[#14241E] text-white px-6 py-6 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald-400/15 blur-2xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider mb-3">
                  <ShieldCheck weight="fill" className="w-3.5 h-3.5" />
                  goSTOPS Team Portal
                </div>
                <h1 className="text-xl font-extrabold tracking-tight">Sign in to Dashboard</h1>
                <p className="text-xs text-emerald-200/75 mt-1">
                  For Hostel Staff, Hostel Managers, and Central Admins.
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <EnvelopeSimple
                      weight="duotone"
                      className="w-4 h-4 text-[#59413c] absolute left-3.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="manager@gostops.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Password</label>
                  <div className="relative">
                    <LockKey
                      weight="duotone"
                      className="w-4 h-4 text-[#59413c] absolute left-3.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#111c2d]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeSlash weight="duotone" className="w-4 h-4" />
                      ) : (
                        <Eye weight="duotone" className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-60"
                >
                  {loading && <CircleNotch className="w-4 h-4 animate-spin" />}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
