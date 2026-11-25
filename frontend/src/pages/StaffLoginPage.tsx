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
  User,
  Buildings,
  MapPin,
} from '@phosphor-icons/react';
import { apiRequest, ApiError, setSessionToken } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { useAuth, type UserRole } from '../context/AuthContext';
import { Footer } from '../components/Footer';

export function StaffLoginPage() {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [hostelName, setHostelName] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiRequest<{ user: { role: UserRole }; sessionToken?: string }>(
          '/auth/staff/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );
        if (res.sessionToken) {
          setSessionToken(res.sessionToken);
          disconnectSocket();
        }
        await refreshAuth();
        if (res.user.role === 'CENTRAL_ADMIN') navigate('/admin');
        else if (res.user.role === 'HOSTEL_MANAGER') navigate('/manager');
        else navigate('/staff');
      } else {
        const res = await apiRequest<{ sessionToken?: string }>('/auth/staff/register', {
          method: 'POST',
          body: JSON.stringify({
            nickname: nickname.trim(),
            email: email.trim(),
            password,
            hostelName: hostelName.trim(),
            city: city.trim(),
          }),
        });
        if (res.sessionToken) {
          setSessionToken(res.sessionToken);
          disconnectSocket();
        }
        await refreshAuth();
        navigate('/manager');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
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
                <h1 className="text-xl font-extrabold tracking-tight">
                  {mode === 'login' ? 'Sign in to Dashboard' : 'Create Hostel & Manager Account'}
                </h1>
                <p className="text-xs text-emerald-200/75 mt-1">
                  {mode === 'login'
                    ? 'For Hostel Staff, Hostel Managers, and Central Admins.'
                    : 'Spin up your own hostel/space & QR code in 10 seconds.'}
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-4">
              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#f0f3ff]">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className={`py-2 rounded-full text-xs font-bold transition ${
                    mode === 'login'
                      ? 'bg-[#14241E] text-emerald-300 shadow-xs'
                      : 'text-[#59413c] hover:text-[#111c2d]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className={`py-2 rounded-full text-xs font-bold transition ${
                    mode === 'register'
                      ? 'bg-[#a93017] text-white shadow-xs'
                      : 'text-[#59413c] hover:text-[#111c2d]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#111c2d] mb-1">
                        Your Name
                      </label>
                      <div className="relative">
                        <User
                          weight="duotone"
                          className="w-4 h-4 text-[#59413c] absolute left-3.5 top-1/2 -translate-y-1/2"
                        />
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={40}
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="e.g., Saurabh Kumar"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-[#111c2d] mb-1">
                          Hostel / Space Name
                        </label>
                        <div className="relative">
                          <Buildings
                            weight="duotone"
                            className="w-4 h-4 text-[#59413c] absolute left-3 top-1/2 -translate-y-1/2"
                          />
                          <input
                            type="text"
                            required
                            minLength={2}
                            maxLength={120}
                            value={hostelName}
                            onChange={(e) => setHostelName(e.target.value)}
                            placeholder="goSTOPS Jaipur"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#111c2d] mb-1">City</label>
                        <div className="relative">
                          <MapPin
                            weight="duotone"
                            className="w-4 h-4 text-[#59413c] absolute left-3 top-1/2 -translate-y-1/2"
                          />
                          <input
                            type="text"
                            required
                            minLength={2}
                            maxLength={80}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Jaipur"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1">Work Email</label>
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
                  <label className="block text-xs font-bold text-[#111c2d] mb-1">Password</label>
                  <div className="relative">
                    <LockKey
                      weight="duotone"
                      className="w-4 h-4 text-[#59413c] absolute left-3.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'register' ? 8 : 6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter your password'}
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
                  {loading
                    ? mode === 'login'
                      ? 'Signing in...'
                      : 'Creating Hostel & Account...'
                    : mode === 'login'
                      ? 'Sign In'
                      : 'Create Hostel & Open Dashboard'}
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
