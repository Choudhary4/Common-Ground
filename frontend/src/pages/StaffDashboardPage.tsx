import { useCallback, useEffect, useState } from 'react';
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
} from '@phosphor-icons/react';
import { StaffLayout } from '../components/StaffLayout';
import { apiRequest, ApiError } from '../lib/api';

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
  const [overview, setOverview] = useState<Overview | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [accessCode, setAccessCode] = useState<AccessCodeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'qr-revoke' | 'code-revoke' | null>(null);
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StaffLayout
      title={overview?.hostelName ?? 'Staff Dashboard'}
      subtitle={overview ? `${overview.hostelCity} · QR & Access Code Management` : undefined}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            {error}
          </div>
        )}

        {/* KPI Bento Row */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Active Sessions</p>
              <UsersThree weight="duotone" className="w-4 h-4 text-[#14241E]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.activeTravellersCount ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Active Plans</p>
              <CalendarCheck weight="duotone" className="w-4 h-4 text-[#a93017]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.activeActivitiesCount ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <p className="text-[11px] font-bold text-[#59413c]">QR Status</p>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                overview?.qrStatus === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {overview?.qrStatus === 'ACTIVE' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
              {overview?.qrStatus ?? '—'}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <p className="text-[11px] font-bold text-[#59413c]">Access Code</p>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                overview?.accessCodeStatus === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {overview?.accessCodeStatus === 'ACTIVE' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
              {overview?.accessCodeStatus ?? '—'}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Management */}
          <section className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="no-print flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                  <QrCode weight="duotone" className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-extrabold text-[#111c2d]">Hostel QR Code</h2>
              </div>
              {qr && (
                <span className="px-2.5 py-1 rounded-full bg-[#f0f3ff] text-[#14241E] text-[11px] font-bold">
                  {qr.scanCount} scans
                </span>
              )}
            </div>

            {qr ? (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-[#14241E] text-white flex flex-col items-center text-center shadow-sm">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Common Ground
                  </span>
                  <p className="text-sm font-extrabold">{overview?.hostelName}</p>
                  <p className="text-[11px] text-emerald-200/75 mb-4">
                    Scan to meet fellow travellers at this hostel
                  </p>
                  <img
                    src={qr.qrDataUrl}
                    alt="Hostel Common Ground QR"
                    className="w-52 h-52 rounded-2xl bg-white p-2.5 shadow-md"
                  />
                  {accessCode && (
                    <p className="mt-3 text-xs text-emerald-100">
                      Access Code:{' '}
                      <strong className="font-mono text-emerald-300 tracking-wider">
                        {accessCode.code}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="no-print flex items-center gap-2 p-2.5 rounded-xl bg-[#f0f3ff] border border-[#e0bfb8]/30">
                  <input
                    readOnly
                    value={qr.qrUrl}
                    className="flex-1 bg-transparent text-xs font-mono text-[#111c2d] outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#14241E] shadow-2xs"
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check weight="bold" className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy weight="duotone" className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="no-print flex flex-wrap gap-2">
                  <a
                    href={qr.qrDataUrl}
                    download="common-ground-qr.png"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold transition"
                  >
                    <DownloadSimple weight="bold" className="w-3.5 h-3.5" /> Download PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-xs font-bold transition"
                  >
                    <Printer weight="duotone" className="w-3.5 h-3.5" /> Print
                  </button>
                  <button
                    type="button"
                    onClick={generateQr}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold disabled:opacity-60 transition"
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-60 transition"
                  >
                    <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs font-semibold text-[#59413c]">
                  No active QR code for this hostel.
                </p>
                <button
                  type="button"
                  onClick={generateQr}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs disabled:opacity-60 transition"
                >
                  {busyAction === 'qr-generate' && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                  {busyAction === 'qr-generate' ? 'Generating QR...' : 'Generate QR Code'}
                </button>
              </div>
            )}
          </section>

          {/* Access Code Management */}
          <section className="no-print bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Key weight="duotone" className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#111c2d]">Hostel Access Code</h2>
                <p className="text-[11px] text-[#59413c]">
                  Auto-embedded in your QR URL for instant guest check-in
                </p>
              </div>
            </div>

            {accessCode ? (
              <div className="p-6 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/40 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#59413c] mb-1">
                  Current Active Code
                </p>
                <p className="text-3xl font-extrabold font-mono tracking-[0.2em] text-[#14241E]">
                  {accessCode.code}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Created {new Date(accessCode.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/30 text-center text-xs font-semibold text-[#59413c]">
                No active access code. Generate one to allow onboarding.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={regenerateCode}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs disabled:opacity-60 transition"
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
              {accessCode && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('code-revoke')}
                  disabled={busyAction !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-60 transition"
                >
                  <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke Code
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4"
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
    </StaffLayout>
  );
}
