import { useCallback, useEffect, useState } from 'react';
import { QrCode, Download, Printer, RefreshCw, Ban, KeyRound, Copy, Check } from 'lucide-react';
import { StaffLayout } from '../components/StaffLayout';
import { apiRequest } from '../lib/api';

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
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await apiRequest('/staff/qr/generate', { method: 'POST' });
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const revokeQr = async () => {
    if (!window.confirm('Revoke current QR code? Travellers will no longer be able to scan it.')) return;
    setBusy(true);
    try {
      await apiRequest('/staff/qr/revoke', { method: 'POST' });
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const regenerateCode = async () => {
    setBusy(true);
    try {
      await apiRequest('/staff/access-code/regenerate', { method: 'POST' });
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const revokeCode = async () => {
    if (!window.confirm('Revoke current hostel access code?')) return;
    setBusy(true);
    try {
      await apiRequest('/staff/access-code/revoke', { method: 'POST' });
      await loadAll();
    } finally {
      setBusy(false);
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
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Active Sessions</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.activeTravellersCount ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Active Activities</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.activeActivitiesCount ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">QR Status</p>
            <p className="text-sm font-bold text-emerald-700 mt-2">
              {overview?.qrStatus ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Access Code</p>
            <p className="text-sm font-bold text-emerald-700 mt-2">
              {overview?.accessCodeStatus ?? '—'}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Management */}
          <section className="bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 space-y-4">
            <div className="no-print flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#E85D3F]" />
                <h2 className="text-base font-bold text-slate-900">Hostel QR Code</h2>
              </div>
              {qr && (
                <span className="text-xs text-slate-500 font-medium">{qr.scanCount} scans</span>
              )}
            </div>

            {qr ? (
              <div className="space-y-4">
                <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-amber-200/70 flex flex-col items-center text-center">
                  <p className="text-sm font-bold text-slate-900 mb-1">
                    {overview?.hostelName} — Common Ground
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    Scan to meet fellow travellers at this hostel
                  </p>
                  <img
                    src={qr.qrDataUrl}
                    alt="Hostel Common Ground QR"
                    className="w-52 h-52 rounded-xl bg-white p-2 border border-slate-200"
                  />
                  {accessCode && (
                    <p className="mt-3 text-xs text-slate-700">
                      Access Code: <strong className="font-mono">{accessCode.code}</strong>
                    </p>
                  )}
                </div>

                <div className="no-print flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <input
                    readOnly
                    value={qr.qrUrl}
                    className="flex-1 bg-transparent text-xs font-mono text-slate-600 outline-none"
                  />
                  <button
                    onClick={copyUrl}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                    title="Copy URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="no-print flex flex-wrap gap-2">
                  <a
                    href={qr.qrDataUrl}
                    download={`common-ground-qr.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PNG
                  </a>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button
                    onClick={generateQr}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <button
                    onClick={revokeQr}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold"
                  >
                    <Ban className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-slate-600">No active QR code for this hostel.</p>
                <button
                  onClick={generateQr}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold"
                >
                  Generate QR Code
                </button>
              </div>
            )}
          </section>

          {/* Access Code Management */}
          <section className="no-print bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#E85D3F]" />
              <h2 className="text-base font-bold text-slate-900">Hostel Access Code</h2>
            </div>
            <p className="text-xs text-slate-500">
              Share this code at reception or in the common room so only checked-in guests can
              enter your hostel's social space.
            </p>

            {accessCode ? (
              <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-amber-200/70 text-center">
                <p className="text-xs text-slate-500 mb-1">Current Active Code</p>
                <p className="text-3xl font-extrabold font-mono tracking-widest text-slate-900">
                  {accessCode.code}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  Created {new Date(accessCode.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 text-center text-sm text-slate-500">
                No active access code. Generate one to allow onboarding.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={regenerateCode}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold hover:bg-[#D94E32]"
              >
                <RefreshCw className="w-3.5 h-3.5" />{' '}
                {accessCode ? 'Regenerate Code' : 'Generate Code'}
              </button>
              {accessCode && (
                <button
                  onClick={revokeCode}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold"
                >
                  <Ban className="w-3.5 h-3.5" /> Revoke Code
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </StaffLayout>
  );
}
