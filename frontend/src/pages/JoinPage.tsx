import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  WarningCircle,
  CircleNotch,
  CheckCircle,
  Broadcast,
  Check,
  Key,
  User,
  ShieldCheck,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { enablePushNotifications, isPushSupported } from '../lib/push';
import { PRESET_AVATARS } from '../components/Avatar';
import { Footer } from '../components/Footer';

interface HostelInfo {
  id: string;
  name: string;
  city: string;
  address: string;
}

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const codeFromQr = searchParams.get('code')?.trim().toUpperCase() ?? '';
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshAuth } = useAuth();

  const [hostel, setHostel] = useState<HostelInfo | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string | null>(PRESET_AVATARS[0]);
  const [accessCode, setAccessCode] = useState(codeFromQr);
  const [showCodeInput, setShowCodeInput] = useState(!codeFromQr);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function resolveQr() {
      if (!token) {
        setQrError('Missing QR token.');
        setLoadingQr(false);
        return;
      }
      try {
        const res = await apiRequest<{ hostel: HostelInfo }>(`/qr/resolve/${token}`);
        if (active) setHostel(res.hostel);
      } catch (err) {
        if (active) {
          setQrError(err instanceof ApiError ? err.message : 'Invalid or revoked QR code.');
        }
      } finally {
        if (active) setLoadingQr(false);
      }
    }
    void resolveQr();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!authLoading && user && hostel && user.role === 'TRAVELLER' && user.hostelId === hostel.id) {
      navigate('/app', { replace: true });
    }
  }, [authLoading, user, hostel, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiRequest('/auth/traveller/onboard', {
        method: 'POST',
        body: JSON.stringify({
          qrToken: token,
          nickname: nickname.trim(),
          accessCode: accessCode.trim(),
          avatar,
        }),
      });
      await refreshAuth();
      if (isPushSupported() && Notification.permission === 'default') {
        await enablePushNotifications().catch(() => {});
      }
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setShowCodeInput(true);
      }
      setFormError(err instanceof ApiError ? err.message : 'Could not join hostel space.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-[2rem] border border-[#e0bfb8]/35 shadow-sm overflow-hidden">
          {/* Dark Emerald Hostel Radar Header */}
          <div className="bg-[#062018] text-white px-6 py-6 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-14 -right-14 w-40 h-40 rounded-full bg-emerald-400/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-14 w-36 h-36 rounded-full bg-[#a93017]/25 blur-2xl" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-extrabold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>GOSTOPS</span>
                <span className="text-emerald-400">×</span>
                <span>COMMON GROUND</span>
              </div>

              {hostel ? (
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 text-[11px] font-bold mb-2">
                    <MapPin weight="fill" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {hostel.name} · {hostel.city}
                    </span>
                  </div>
                  <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
                    Welcome to Common Ground
                  </h1>
                  <p className="text-xs text-emerald-100/75 mt-1">
                    Pick a nickname &amp; avatar to enter your hostel&apos;s live social radar.
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Hostel Check-In</h1>
                  <p className="text-xs text-emerald-100/75 mt-0.5">
                    Connecting you to your hostel&apos;s private social space
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-7">
            {loadingQr ? (
              <div className="py-12 flex flex-col items-center text-[#59413c] gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#062018] text-emerald-300 flex items-center justify-center shadow-xs">
                  <Broadcast weight="duotone" className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-xs font-bold">Identifying your hostel...</p>
              </div>
            ) : qrError ? (
              <div className="py-6 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <WarningCircle weight="duotone" className="w-7 h-7" />
                </div>
                <h2 className="text-base font-extrabold text-[#111c2d]">QR Code Unavailable</h2>
                <p className="text-xs text-[#59413c]">{qrError}</p>
                <p className="text-[11px] text-slate-400 pt-2">
                  Please ask hostel reception for the latest Common Ground QR code.
                </p>
              </div>
            ) : (
              <>
                {formError && (
                  <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nickname */}
                  <div>
                    <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                      Your Nickname
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
                        placeholder="e.g., Kabir, Maya, SoloSam"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                      />
                    </div>
                  </div>

                  {/* Quick Avatar Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#111c2d]">
                        Pick an Avatar{' '}
                        <span className="font-medium text-[#59413c]">(optional)</span>
                      </label>
                      {avatar && (
                        <button
                          type="button"
                          onClick={() => setAvatar(null)}
                          className="text-[11px] font-bold text-[#59413c] hover:text-[#a93017]"
                        >
                          Use initials
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_AVATARS.slice(0, 6).map((url) => {
                        const selected = avatar === url;
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setAvatar(selected ? null : url)}
                            className={`relative rounded-2xl p-0.5 transition active:scale-95 ${
                              selected
                                ? 'ring-2 ring-[#a93017] bg-[#ffdad3]/40'
                                : 'bg-[#f9f9ff] hover:ring-2 hover:ring-slate-300'
                            }`}
                          >
                            <img
                              src={url}
                              alt="Avatar option"
                              className="w-full aspect-square rounded-xl"
                            />
                            {selected && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#a93017] text-white flex items-center justify-center shadow-xs">
                                <Check weight="bold" className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Access Code */}
                  {showCodeInput ? (
                    <div>
                      <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                        Hostel Access Code
                      </label>
                      <div className="relative">
                        <Key
                          weight="duotone"
                          className="w-4 h-4 text-[#59413c] absolute left-3.5 top-1/2 -translate-y-1/2"
                        />
                        <input
                          type="text"
                          required
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                          placeholder="Ask hostel reception (e.g., JPR101)"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm uppercase tracking-wider font-mono text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#ccf5e7]/70 border border-emerald-200 text-xs text-[#0b6b52]">
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 shrink-0" />
                        Access verified via hostel QR
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCodeInput(true)}
                        className="text-[#062018] underline font-bold"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-60"
                  >
                    {submitting && <CircleNotch className="w-4 h-4 animate-spin" />}
                    <span>{submitting ? 'Connecting...' : 'Enter Hostel Space'}</span>
                    {!submitting && <ArrowRight weight="bold" className="w-4 h-4" />}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#59413c]">
                  <ShieldCheck weight="duotone" className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>No email or room number needed · Active for 72 hours</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
