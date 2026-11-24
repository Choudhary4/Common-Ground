import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  DownloadSimple,
  Printer,
  ArrowsClockwise,
  Prohibit,
  Key,
  Copy,
  Check,
  CircleNotch,
  UsersThree,
  CalendarCheck,
  SignOut,
  MapPin,
  Info,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';

interface Overview {
  hostelName: string;
  hostelCity: string;
  activeTravellersCount: number;
  activeActivitiesCount: number;
  qrStatus: 'ACTIVE' | 'NONE';
  accessCodeStatus: 'ACTIVE' | 'NONE';
}

interface QrData {
  id: string;
  qrUrl: string;
  qrDataUrl: string;
  scanCount: number;
  createdAt: string;
}

interface AccessCodeData {
  id: string;
  code: string;
  status: string;
  createdAt: string;
}

export function StaffDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [accessCode, setAccessCode] = useState<AccessCodeData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'qr-revoke' | 'code-revoke' | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [ov, qrRes, codeRes] = await Promise.all([
      apiRequest<Overview>('/staff/overview'),
      apiRequest<{ qr: QrData | null }>('/staff/qr'),
      apiRequest<{ accessCode: AccessCodeData | null }>('/staff/access-code'),
    ]);
    setOverview(ov);
    setQr(qrRes.qr);
    setAccessCode(codeRes.accessCode);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const generateQr = async () => {
    setBusyAction('qr-generate');
    setError(null);
    try {
      await apiRequest('/staff/qr/generate', { method: 'POST' });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate QR code');
    } finally {
      setBusyAction(null);
    }
  };

  const revokeQr = async () => {
    setBusyAction('qr-revoke');
    setError(null);
    try {
      await apiRequest('/staff/qr/revoke', { method: 'POST' });
      setConfirmAction(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke QR code');
    } finally {
      setBusyAction(null);
    }
  };

  const regenerateCode = async () => {
    setBusyAction('code-generate');
    setError(null);
    try {
      await apiRequest('/staff/access-code/regenerate', { method: 'POST' });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate access code');
    } finally {
      setBusyAction(null);
    }
  };

  const revokeCode = async () => {
    setBusyAction('code-revoke');
    setError(null);
    try {
      await apiRequest('/staff/access-code/revoke', { method: 'POST' });
      setConfirmAction(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke access code');
    } finally {
      setBusyAction(null);
    }
  };

  const copyUrl = () => {
    if (!qr) return;
    void navigator.clipboard.writeText(qr.qrUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyCode = () => {
    if (!accessCode) return;
    void navigator.clipboard.writeText(accessCode.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/staff/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      {/* Dark Emerald Reception Desk Top Bar */}
      <header className="no-print bg-[#062018] text-white sticky top-0 z-20 border-b border-emerald-500/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white/10 border border-emerald-400/25 text-emerald-300 font-extrabold text-xs flex items-center justify-center shrink-0">
              CG
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold tracking-wider uppercase truncate">
                GOSTOPS <span className="text-emerald-400">×</span> COMMON GROUND
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 text-[10px] font-extrabold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE DESK
              </span>
            </div>
            {overview && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-emerald-100 shrink-0">
                <MapPin weight="fill" className="w-3.5 h-3.5 text-emerald-400" />
                {overview.hostelName} · Front Desk
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition disabled:opacity-60 shrink-0"
          >
            {loggingOut ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SignOut weight="bold" className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Sub-breadcrumb Bar */}
      <div className="no-print bg-white border-b border-[#e0bfb8]/25">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-semibold">
            <span>Hostel Operations</span>
            <span>/</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] font-extrabold text-[11px]">
              QR Standee &amp; Check-In Codes
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#111c2d]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sync Active · {overview?.hostelCity ?? 'Front Desk'}
          </span>
        </div>
      </div>

      {/* Main Split-Screen Desk */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="no-print p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Print-Ready QR Standee & Digital Poster */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-[#e0bfb8]/30 p-5 sm:p-7 space-y-5 shadow-2xs">
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-[#111c2d]">
                    Lobby QR Standee &amp; Digital Poster
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[10px] font-extrabold">
                    PRINT-READY A4/A5
                  </span>
                </div>
                <p className="text-xs text-[#59413c] mt-0.5">
                  Scanned by travellers at check-in counter to join {overview?.hostelName ?? 'your hostel'}
                </p>
              </div>
              {qr && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-xs font-extrabold">
                  <QrCode weight="duotone" className="w-3.5 h-3.5" />
                  {qr.scanCount} scans
                </span>
              )}
            </div>

            {qr ? (
              <>
                <div className="rounded-3xl bg-[#062018] text-white p-7 sm:p-9 text-center space-y-5 shadow-md">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-300/75">
                    <span>{overview?.hostelName} · COMMON ROOM</span>
                    <span className="px-2.5 py-0.5 rounded bg-white/10">FRONT DESK</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#e66a4e]">
                      Connect with Solo Backpackers
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">
                      Scan to Join Common Ground
                    </h2>
                    <p className="text-xs text-emerald-100/75 mt-1.5 max-w-sm mx-auto">
                      Discover in-house travellers, join rooftop chai, sunset walks, and live hostel
                      hangouts.
                    </p>
                  </div>
                  <div className="inline-block bg-white p-4 rounded-3xl shadow-lg">
                    <img
                      src={qr.qrDataUrl}
                      alt="Hostel Common Ground QR"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300/80 pt-2">
                    <span>No App Download Required</span>
                    {accessCode && (
                      <span className="font-mono px-2.5 py-0.5 rounded bg-white/10 text-emerald-300">
                        CODE: {accessCode.code}
                      </span>
                    )}
                  </div>
                </div>

                <div className="no-print flex items-center gap-2 p-2.5 rounded-2xl bg-[#f0f3ff] border border-[#e0bfb8]/30">
                  <input
                    readOnly
                    value={qr.qrUrl}
                    className="flex-1 bg-transparent text-xs font-mono text-[#111c2d] outline-none px-1"
                  />
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#111c2d] text-xs font-bold shadow-2xs shrink-0"
                  >
                    {copiedUrl ? (
                      <Check weight="bold" className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy weight="duotone" className="w-3.5 h-3.5" />
                    )}
                    {copiedUrl ? 'Copied' : 'Copy URL'}
                  </button>
                </div>

                <div className="no-print flex flex-wrap gap-2">
                  <a
                    href={qr.qrDataUrl}
                    download="common-ground-qr.png"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold transition"
                  >
                    <DownloadSimple weight="bold" className="w-3.5 h-3.5" /> Download PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold transition"
                  >
                    <Printer weight="duotone" className="w-3.5 h-3.5" /> Print Poster
                  </button>
                  <button
                    type="button"
                    onClick={generateQr}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold disabled:opacity-60 transition"
                  >
                    {busyAction === 'qr-generate' ? (
                      <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                    )}
                    {busyAction === 'qr-generate' ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction('qr-revoke')}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-60 transition"
                  >
                    <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center space-y-3">
                <p className="text-xs font-semibold text-[#59413c]">
                  No active QR code for this hostel.
                </p>
                <button
                  type="button"
                  onClick={generateQr}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs disabled:opacity-60"
                >
                  {busyAction === 'qr-generate' && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                  {busyAction === 'qr-generate' ? 'Generating QR...' : 'Generate QR Code'}
                </button>
              </div>
            )}
          </section>

          {/* Right Column: Hostel Access Code + Live Hostel Pulse */}
          <div className="no-print lg:col-span-5 space-y-5">
            {/* Access Code Card */}
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#ccf5e7] text-[#0b6b52] flex items-center justify-center">
                    <Key weight="duotone" className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#111c2d]">Hostel Access Code</h2>
                    <p className="text-[11px] text-[#59413c]">Manual passkey for check-in desk</p>
                  </div>
                </div>
                {accessCode && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[10px] font-extrabold">
                    Active
                  </span>
                )}
              </div>

              {accessCode ? (
                <div className="rounded-2xl bg-gradient-to-br from-[#062018] to-[#111c2d] p-7 text-center shadow-inner">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
                    Front Desk Passkey
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold font-mono tracking-[0.22em] text-emerald-400">
                    {accessCode.code}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Guests can enter this code if camera scan is unavailable
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#f9f9ff] text-center text-xs font-semibold text-[#59413c]">
                  No active access code. Generate one to allow onboarding.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {accessCode && (
                  <button
                    type="button"
                    onClick={copyCode}
                    className="py-2.5 rounded-xl bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    {copiedCode ? (
                      <Check weight="bold" className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Copy weight="duotone" className="w-4 h-4" />
                    )}
                    {copiedCode ? 'Copied!' : 'Copy Code'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={regenerateCode}
                  disabled={busyAction !== null}
                  className={`${
                    accessCode ? '' : 'col-span-2'
                  } py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition`}
                >
                  {busyAction === 'code-generate' ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                  )}
                  {busyAction === 'code-generate'
                    ? 'Generating...'
                    : accessCode
                      ? 'Regenerate Code'
                      : 'Generate Code'}
                </button>
              </div>

              {accessCode && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('code-revoke')}
                  disabled={busyAction !== null}
                  className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke Access Code
                </button>
              )}

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 leading-relaxed">
                <Info weight="fill" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Regenerating this code updates the QR join URL automatically. Rotate during shift
                  handovers or security resets.
                </span>
              </div>
            </section>

            {/* Live Hostel Pulse Card */}
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#111c2d] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Hostel Pulse
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#0b6b52] text-[10px] font-bold">
                  Real-time feed
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/25">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#59413c]">Active Guests</p>
                    <UsersThree weight="duotone" className="w-4 h-4 text-emerald-700" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
                    {overview?.activeTravellersCount ?? '—'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Verified checked-in
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/25">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#59413c]">Open Plans</p>
                    <CalendarCheck weight="duotone" className="w-4 h-4 text-[#a93017]" />
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold text-[#111c2d]">
                      {overview?.activeActivitiesCount ?? '—'}
                    </p>
                    <span className="text-[10px] font-extrabold text-[#a93017]">Active</span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Common-room hangouts
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />

      {/* Custom Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 bg-[#062018]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#e0bfb8]/35"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-[#111c2d]">
              {confirmAction === 'qr-revoke' ? 'Revoke Hostel QR?' : 'Revoke Access Code?'}
            </h3>
            <p className="text-xs text-[#59413c] leading-relaxed">
              {confirmAction === 'qr-revoke'
                ? 'Travellers will no longer be able to scan the existing QR poster until you generate a new one.'
                : 'New guests will not be able to join until you generate a fresh hostel access code.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-full bg-[#f0f3ff] text-[#111c2d] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => (confirmAction === 'qr-revoke' ? revokeQr() : revokeCode())}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {busyAction && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
