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
  LockSimple,
  QrCode,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { enablePushNotifications, isPushSupported } from '../lib/push';
import { Avatar, PRESET_AVATARS } from '../components/Avatar';
import { Footer } from '../components/Footer';

interface HostelInfo {
  id: string;
  name: string;
  city: string;
  address: string;
  activeTravellersCount?: number;
}

const AVATAR_OPTIONS = [
  { url: PRESET_AVATARS[0], label: 'Nomad' },
  { url: PRESET_AVATARS[1], label: 'Chai Lover' },
  { url: PRESET_AVATARS[2], label: 'Acoustic' },
  { url: PRESET_AVATARS[3], label: 'Sunset' },
  { url: PRESET_AVATARS[4], label: 'Remote' },
  { url: PRESET_AVATARS[5], label: 'Explorer' },
];

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
  const [avatar, setAvatar] = useState<string | null>(AVATAR_OPTIONS[0].url);
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

  const activeCount = hostel?.activeTravellersCount ?? 0;
  const nicknameReady = nickname.trim().length >= 2;

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[430px] bg-white rounded-[2rem] border border-[#e0bfb8]/30 shadow-xl overflow-hidden">
          {/* Boutique Keycard Dark Emerald Header */}
          <div
            className="bg-[#062018] text-white px-6 pt-6 pb-16 relative overflow-hidden"
            style={{
              backgroundImage:
                'radial-gradient(rgba(52,211,153,0.12) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-[#a93017]/20 blur-3xl" />

            <div className="relative z-10 space-y-3.5">
              {/* Top Keycard Strip */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-extrabold tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>GOSTOPS</span>
                  <span className="text-emerald-400">×</span>
                  <span>COMMON GROUND</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-200/70">
                  <LockSimple weight="bold" className="w-3 h-3" />
                  Keycard Pass
                </span>
              </div>

              {hostel ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 text-[11px] font-bold">
                    <MapPin weight="fill" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{hostel.name}</span>
                    <span className="text-emerald-400/60">·</span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-200">
                      <Check weight="bold" className="w-3 h-3" /> Verified QR
                    </span>
                  </div>

                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight leading-snug">
                      Welcome to the Common Room
                    </h1>
                    <p className="text-xs text-emerald-100/75 mt-1 leading-relaxed">
                      Scan confirmed. Drop your backpack, grab a vibe, and meet fellow travellers
                      tonight.
                    </p>
                  </div>

                  {/* Live Common Room Pulse */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-100/85">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <strong className="text-emerald-300 font-extrabold">
                        {activeCount} {activeCount === 1 ? 'traveller' : 'travellers'}
                      </strong>{' '}
                      active in common room
                    </span>
                    <div className="flex -space-x-1.5">
                      {PRESET_AVATARS.slice(0, 2).map((u, idx) => (
                        <img
                          key={u}
                          src={u}
                          alt={`Guest ${idx + 1}`}
                          className="w-5 h-5 rounded-full border border-[#062018] bg-[#f0f3ff]"
                        />
                      ))}
                      {activeCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#ccf5e7] text-[#062018] border border-[#062018] text-[9px] font-extrabold flex items-center justify-center">
                          +{activeCount}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Hostel Keycard Check-In</h1>
                  <p className="text-xs text-emerald-100/75 mt-0.5">
                    Verifying your hostel QR code...
                  </p>
                </div>
              )}
            </div>

            {/* Keycard Ticket Seam Notches */}
            <span className="absolute -bottom-2.5 left-4 w-5 h-5 rounded-full bg-white" />
            <span className="absolute -bottom-2.5 right-4 w-5 h-5 rounded-full bg-white" />
          </div>

          {/* Overlapping Circular Selected Avatar Preview */}
          {!loadingQr && !qrError && (
            <div className="relative -mt-12 flex justify-center z-10">
              <div className="relative w-24 h-24 rounded-full bg-white p-1.5 shadow-lg">
                <Avatar
                  src={avatar}
                  name={nickname.trim() || 'CG'}
                  className="w-full h-full rounded-full"
                />
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#a93017] text-white border-2 border-white flex items-center justify-center shadow-xs">
                  <Check weight="bold" className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}

          {/* Card Body */}
          <div className="px-6 pt-3 pb-6 sm:px-7">
            {loadingQr ? (
              <div className="py-12 flex flex-col items-center text-[#59413c] gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#062018] text-emerald-300 flex items-center justify-center shadow-xs">
                  <Broadcast weight="duotone" className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-xs font-bold">Identifying your hostel...</p>
              </div>
            ) : qrError ? (
              <div className="py-8 text-center space-y-2.5">
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
                <div className="text-center mb-5">
                  <h2 className="text-lg font-extrabold text-[#111c2d]">
                    Create your Hostel Identity
                  </h2>
                  <p className="text-xs text-[#59413c] mt-0.5">
                    Quick 10-second setup. Visible only to in-house guests.
                  </p>
                </div>

                {formError && (
                  <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Hostel Nickname */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#111c2d]">
                        Hostel Nickname
                      </label>
                      <span className="text-[10px] font-medium text-slate-400">
                        First name or trail handle
                      </span>
                    </div>
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
                        className="w-full pl-10 pr-16 py-2.5 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm font-semibold text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                      />
                      {nicknameReady && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[10px] font-extrabold">
                          Ready
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Backpacker Avatar Strip */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#111c2d]">
                        Pick Your Backpacker Avatar
                      </label>
                      {avatar ? (
                        <button
                          type="button"
                          onClick={() => setAvatar(null)}
                          className="text-[10px] font-bold text-[#a93017] hover:underline"
                        >
                          Use initials
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-[#a93017]">6 available</span>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATAR_OPTIONS.map((opt) => {
                        const selected = avatar === opt.url;
                        return (
                          <button
                            key={opt.url}
                            type="button"
                            onClick={() => setAvatar(selected ? null : opt.url)}
                            className="flex flex-col items-center gap-1 group"
                          >
                            <div
                              className={`relative w-full aspect-square rounded-full p-0.5 transition active:scale-95 ${
                                selected
                                  ? 'ring-2 ring-[#a93017] bg-[#ffdad3]/40'
                                  : 'bg-[#f9f9ff] group-hover:ring-2 group-hover:ring-slate-300'
                              }`}
                            >
                              <img
                                src={opt.url}
                                alt={opt.label}
                                className="w-full h-full rounded-full object-cover"
                              />
                              {selected && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#a93017] text-white border border-white flex items-center justify-center">
                                  <Check weight="bold" className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[9px] truncate w-full text-center ${
                                selected ? 'font-extrabold text-[#a93017]' : 'font-semibold text-slate-400'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Verified QR Chip or Manual Access Code */}
                  {showCodeInput ? (
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#111c2d] mb-1.5">
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
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm uppercase tracking-wider font-mono text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-2xl bg-[#e6fbf3] border border-emerald-200/80">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/80 text-emerald-700 flex items-center justify-center shrink-0">
                          <QrCode weight="duotone" className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#062018] flex items-center gap-1">
                            Access verified via hostel QR
                            <CheckCircle weight="fill" className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          </p>
                          <p className="text-[10px] font-medium text-[#0b6b52]/80 truncate">
                            {hostel?.name} · {hostel?.city}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCodeInput(true)}
                        className="text-xs font-extrabold text-[#062018] underline shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Terracotta Pill CTA */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#a93017]/20 transition disabled:opacity-60"
                  >
                    {submitting && <CircleNotch className="w-4 h-4 animate-spin" />}
                    <span>{submitting ? 'Connecting...' : 'Enter Hostel Space'}</span>
                    {!submitting && <ArrowRight weight="bold" className="w-4 h-4" />}
                  </button>
                </form>

                {/* Privacy Footer */}
                <div className="mt-5 text-center space-y-1">
                  <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#59413c]">
                    <ShieldCheck weight="duotone" className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>No email or room number needed · 72h private session</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Auto-expires after checkout. Private to verified in-house guests.
                  </p>
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
