import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Plus,
  Flag,
  CheckCircle2,
  XCircle,
  QrCode,
  Download,
  Printer,
  RefreshCw,
  Ban,
  KeyRound,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { StaffLayout } from '../components/StaffLayout';
import { apiRequest, ApiError } from '../lib/api';

interface ManagerOverview {
  hostelName: string;
  activeActivities: number;
  openReports: number;
  activeSessions: number;
  realMetrics: {
    travellersOnboarded: number;
    qrScans: number;
    socialStatusesSet: number;
    activitiesCreated: number;
    activitiesJoined: number;
    joinRequestsAccepted: number;
    activitiesCompleted: number;
  };
}

interface ManagerActivity {
  _id: string;
  title: string;
  creatorType: 'TRAVELLER' | 'HOSTEL_MANAGER';
  creatorNickname: string;
  scheduledAt: string;
  meetingPoint: string;
  confirmedCount: number;
  maxParticipants: number;
  status: string;
}

interface ManagerReport {
  _id: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'DISMISSED' | 'ACTION_TAKEN';
  reporterNickname: string;
  reportedUser?: { id: string; nickname: string; status: string } | null;
  activity?: { id: string; title: string; status: string } | null;
  createdAt: string;
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

function toLocalDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManagerDashboardPage() {
  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);

  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [activities, setActivities] = useState<ManagerActivity[]>([]);
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [qr, setQr] = useState<QrData | null>(null);
  const [accessCode, setAccessCode] = useState<AccessCodeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [tab, setTab] = useState<'activities' | 'reports' | 'create' | 'qr'>('activities');

  // Official activity form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('SOCIAL');
  const [meetingPoint, setMeetingPoint] = useState('Rooftop Common Area');
  const [maxParticipants, setMaxParticipants] = useState(15);
  const [date, setDate] = useState(toLocalDateInput(defaultStart));
  const [startTime, setStartTime] = useState(toLocalTimeInput(defaultStart));
  const [endTime, setEndTime] = useState(toLocalTimeInput(defaultEnd));
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [ov, actRes, repRes, qrRes, codeRes] = await Promise.all([
      apiRequest<ManagerOverview>('/manager/overview'),
      apiRequest<{ activities: ManagerActivity[] }>('/manager/activities'),
      apiRequest<{ reports: ManagerReport[] }>('/manager/reports'),
      apiRequest<{ qr: QrData | null }>('/staff/qr'),
      apiRequest<{ accessCode: AccessCodeData | null }>('/staff/access-code'),
    ]);
    setOverview(ov);
    setActivities(actRes.activities);
    setReports(repRes.reports);
    setQr(qrRes.qr);
    setAccessCode(codeRes.accessCode);
  }, []);

  const generateQr = async () => {
    setQrBusy(true);
    try {
      await apiRequest('/staff/qr/generate', { method: 'POST' });
      await loadAll();
    } finally {
      setQrBusy(false);
    }
  };

  const revokeQr = async () => {
    if (!window.confirm('Revoke current QR code?')) return;
    setQrBusy(true);
    try {
      await apiRequest('/staff/qr/revoke', { method: 'POST' });
      await loadAll();
    } finally {
      setQrBusy(false);
    }
  };

  const regenerateCode = async () => {
    setQrBusy(true);
    try {
      await apiRequest('/staff/access-code/regenerate', { method: 'POST' });
      await loadAll();
    } finally {
      setQrBusy(false);
    }
  };

  const revokeCode = async () => {
    if (!window.confirm('Revoke current access code?')) return;
    setQrBusy(true);
    try {
      await apiRequest('/staff/access-code/revoke', { method: 'POST' });
      await loadAll();
    } finally {
      setQrBusy(false);
    }
  };

  const copyQrUrl = () => {
    if (!qr) return;
    void navigator.clipboard.writeText(qr.qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const createOfficialActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setCreatingActivity(true);
    try {
      const scheduledAt = new Date(`${date}T${startTime}:00`);
      let endsAt = new Date(`${date}T${endTime}:00`);
      if (endsAt <= scheduledAt) {
        endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
      }
      await apiRequest('/activities', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          scheduledAt: scheduledAt.toISOString(),
          endsAt: endsAt.toISOString(),
          meetingPoint,
          maxParticipants: Number(maxParticipants),
          joinMode: 'PUBLIC',
        }),
      });
      setTitle('');
      setDescription('');
      setFormMsg('Official hostel activity published!');
      setTab('activities');
      await loadAll();
    } catch (err) {
      setFormMsg(err instanceof ApiError ? err.message : 'Failed to create activity');
    } finally {
      setCreatingActivity(false);
    }
  };

  const cancelActivity = async (id: string) => {
    if (!window.confirm('Cancel this activity?')) return;
    setBusyId(id);
    try {
      await apiRequest(`/activities/${id}/cancel`, { method: 'POST' });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (
    id: string,
    status: 'DISMISSED' | 'ACTION_TAKEN',
    opts?: { cancelActivity?: boolean; restrictUser?: boolean }
  ) => {
    setBusyId(id);
    try {
      await apiRequest(`/manager/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...opts }),
      });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StaffLayout
      title={overview?.hostelName ?? 'Manager Dashboard'}
      subtitle="Official Activities, Moderation & Real Hostel Analytics"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Active Sessions</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.activeSessions ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Active Activities</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.activeActivities ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Open Reports</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">
              {overview?.openReports ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Real Joins (Non-Demo)</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {overview?.realMetrics.activitiesJoined ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('activities')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'activities' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'
            }`}
          >
            Hostel Activities ({activities.length})
          </button>
          <button
            onClick={() => setTab('create')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'create' ? 'bg-[#E85D3F] text-white' : 'bg-white border border-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Create Official Activity
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'reports' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'
            }`}
          >
            <Flag className="w-3.5 h-3.5" /> Reports ({reports.filter((r) => r.status === 'OPEN').length})
          </button>
          <button
            onClick={() => setTab('qr')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'qr' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> QR &amp; Access Code
          </button>
        </div>

        {tab === 'create' && (
          <form
            onSubmit={createOfficialActivity}
            className="bg-white rounded-2xl border border-amber-200/80 p-6 space-y-4 max-w-xl"
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#E85D3F]" />
              <h2 className="text-base font-bold text-slate-900">Create Official Hostel Activity</h2>
            </div>
            {formMsg && (
              <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs font-medium">
                {formMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Activity Name
              </label>
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Hostel Karaoke & Chai Night"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the official hostel event..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="SOCIAL">Social</option>
                  <option value="GAMES">Games</option>
                  <option value="EXPLORATION">Exploration</option>
                  <option value="FOOD">Food</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  required
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Point
              </label>
              <input
                required
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="Meeting Point"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creatingActivity}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold disabled:opacity-60"
            >
              {creatingActivity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {creatingActivity ? 'Publishing...' : 'Publish Official Activity'}
            </button>
          </form>
        )}

        {tab === 'activities' && (
          <div className="bg-white rounded-2xl border border-amber-200/80 divide-y divide-slate-100">
            {activities.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">No activities yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a._id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{a.title}</span>
                      {a.creatorType === 'HOSTEL_MANAGER' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0EC] text-[#D94E32]">
                          Official
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Host: {a.creatorNickname} · {a.confirmedCount}/{a.maxParticipants} joined ·{' '}
                      {a.meetingPoint}
                    </p>
                  </div>
                  {['OPEN', 'FULL'].includes(a.status) && (
                    <button
                      onClick={() => cancelActivity(a._id)}
                      disabled={busyId === a._id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60"
                    >
                      {busyId === a._id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {busyId === a._id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-amber-200/80 p-6 text-center text-sm text-slate-500">
                No reports submitted for this hostel.
              </div>
            ) : (
              reports.map((r) => (
                <div
                  key={r._id}
                  className="bg-white rounded-2xl border border-amber-200/80 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{r.reason}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {r.status}
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-slate-600">{r.description}</p>}
                  <p className="text-[11px] text-slate-400">
                    Reported by {r.reporterNickname}
                    {r.reportedUser ? ` · User: ${r.reportedUser.nickname}` : ''}
                    {r.activity ? ` · Activity: ${r.activity.title}` : ''}
                  </p>
                  {r.status === 'OPEN' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => resolveReport(r._id, 'DISMISSED')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Dismiss
                      </button>
                      {r.activity && (
                        <button
                          onClick={() =>
                            resolveReport(r._id, 'ACTION_TAKEN', { cancelActivity: true })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel Activity
                        </button>
                      )}
                      {r.reportedUser && (
                        <button
                          onClick={() =>
                            resolveReport(r._id, 'ACTION_TAKEN', { restrictUser: true })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          Restrict User
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'qr' && (
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 space-y-4">
              <div className="no-print flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#E85D3F]" />
                  <h2 className="text-base font-bold text-slate-900">Hostel QR Code</h2>
                </div>
                {qr && <span className="text-xs text-slate-500 font-medium">{qr.scanCount} scans</span>}
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
                      onClick={copyQrUrl}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="no-print flex flex-wrap gap-2">
                    <a
                      href={qr.qrDataUrl}
                      download="common-ground-qr.png"
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
                      disabled={qrBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold disabled:opacity-60"
                    >
                      {qrBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {qrBusy ? 'Working...' : 'Regenerate'}
                    </button>
                    <button
                      onClick={revokeQr}
                      disabled={qrBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold disabled:opacity-60"
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
                    disabled={qrBusy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {qrBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {qrBusy ? 'Generating QR...' : 'Generate QR Code'}
                  </button>
                </div>
              )}
            </section>

            <section className="no-print bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#E85D3F]" />
                <h2 className="text-base font-bold text-slate-900">Hostel Access Code</h2>
              </div>
              <p className="text-xs text-slate-500">
                Embedded automatically inside your hostel QR URL. Regenerate anytime to rotate access.
              </p>

              {accessCode ? (
                <div className="p-6 rounded-2xl bg-[#FAF7F2] border border-amber-200/70 text-center">
                  <p className="text-xs text-slate-500 mb-1">Current Active Code</p>
                  <p className="text-3xl font-extrabold font-mono tracking-widest text-slate-900">
                    {accessCode.code}
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 text-center text-sm text-slate-500">
                  No active access code.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={regenerateCode}
                  disabled={qrBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold hover:bg-[#D94E32] disabled:opacity-60"
                >
                  {qrBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {qrBusy ? 'Generating...' : accessCode ? 'Regenerate Code' : 'Generate Code'}
                </button>
                {accessCode && (
                  <button
                    onClick={revokeCode}
                    disabled={qrBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold"
                  >
                    <Ban className="w-3.5 h-3.5" /> Revoke Code
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
