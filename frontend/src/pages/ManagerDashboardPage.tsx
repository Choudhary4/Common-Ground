import React, { useCallback, useEffect, useState } from 'react';
import {
  Medal,
  Plus,
  Flag,
  CheckCircle,
  XCircle,
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
  Sparkle,
} from '@phosphor-icons/react';
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

  // Custom confirm modal
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'cancel-activity'; id: string; title: string }
    | { type: 'revoke-qr' }
    | { type: 'revoke-code' }
    | null
  >(null);

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
    setQrBusy(true);
    try {
      await apiRequest('/staff/qr/revoke', { method: 'POST' });
      setConfirmModal(null);
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
    setQrBusy(true);
    try {
      await apiRequest('/staff/access-code/revoke', { method: 'POST' });
      setConfirmModal(null);
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
    setBusyId(id);
    try {
      await apiRequest(`/activities/${id}/cancel`, { method: 'POST' });
      setConfirmModal(null);
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

  const openReportsCount = reports.filter((r) => r.status === 'OPEN').length;

  return (
    <StaffLayout
      title={overview?.hostelName ?? 'Hostel Manager'}
      subtitle="Official Activities, Moderation & Real Hostel Analytics"
    >
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Active Sessions</p>
              <UsersThree weight="duotone" className="w-4 h-4 text-[#14241E]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.activeSessions ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Active Plans</p>
              <CalendarCheck weight="duotone" className="w-4 h-4 text-[#a93017]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.activeActivities ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Open Reports</p>
              <Flag weight="duotone" className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-extrabold text-rose-600 mt-1.5">
              {overview?.openReports ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Real Joins</p>
              <Sparkle weight="duotone" className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1.5">
              {overview?.realMetrics.activitiesJoined ?? '—'}
            </p>
          </div>
        </div>

        {/* Navigation Pill Tabs */}
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('activities')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition ${
              tab === 'activities'
                ? 'bg-[#14241E] text-emerald-300 shadow-xs'
                : 'bg-white border border-[#e0bfb8]/40 text-[#59413c] hover:bg-[#f0f3ff]'
            }`}
          >
            <CalendarCheck weight="duotone" className="w-3.5 h-3.5" />
            Hostel Plans ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition ${
              tab === 'create'
                ? 'bg-[#a93017] text-white shadow-xs'
                : 'bg-white border border-[#e0bfb8]/40 text-[#59413c] hover:bg-[#f0f3ff]'
            }`}
          >
            <Plus weight="bold" className="w-3.5 h-3.5" />
            Create Official Event
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition ${
              tab === 'reports'
                ? 'bg-[#14241E] text-emerald-300 shadow-xs'
                : 'bg-white border border-[#e0bfb8]/40 text-[#59413c] hover:bg-[#f0f3ff]'
            }`}
          >
            <Flag weight="duotone" className="w-3.5 h-3.5" />
            Reports ({openReportsCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('qr')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition ${
              tab === 'qr'
                ? 'bg-[#14241E] text-emerald-300 shadow-xs'
                : 'bg-white border border-[#e0bfb8]/40 text-[#59413c] hover:bg-[#f0f3ff]'
            }`}
          >
            <QrCode weight="duotone" className="w-3.5 h-3.5" />
            QR &amp; Access Code
          </button>
        </div>

        {/* Create Official Activity Tab */}
        {tab === 'create' && (
          <form
            onSubmit={createOfficialActivity}
            className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-6 space-y-4 max-w-xl shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                <Medal weight="duotone" className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#111c2d]">
                  Create Official Hostel Activity
                </h2>
                <p className="text-[11px] text-[#59413c]">
                  Appears pinned with an Official badge on every guest&apos;s radar
                </p>
              </div>
            </div>

            {formMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
                {formMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Activity Name</label>
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Hostel Karaoke & Chai Night"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Description</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the official hostel event..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
                >
                  <option value="SOCIAL">Social</option>
                  <option value="GAMES">Games</option>
                  <option value="EXPLORATION">Exploration</option>
                  <option value="FOOD">Food</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Max Participants
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  required
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs sm:text-sm text-[#111c2d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs sm:text-sm text-[#111c2d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs sm:text-sm text-[#111c2d]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Meeting Point</label>
              <input
                required
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="Rooftop Common Area"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
            </div>

            <button
              type="submit"
              disabled={creatingActivity}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-60"
            >
              {creatingActivity && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
              {creatingActivity ? 'Publishing...' : 'Publish Official Activity'}
            </button>
          </form>
        )}

        {/* Activities List Tab */}
        {tab === 'activities' && (
          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 divide-y divide-slate-100 shadow-xs overflow-hidden">
            {activities.length === 0 ? (
              <p className="p-8 text-xs font-semibold text-[#59413c] text-center">
                No hostel activities yet. Create an Official Event to kick things off!
              </p>
            ) : (
              activities.map((a) => (
                <div
                  key={a._id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-[#f9f9ff]/60 transition"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-sm text-[#111c2d]">{a.title}</span>
                      {a.creatorType === 'HOSTEL_MANAGER' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffdad3]/60 text-[#a93017]">
                          Official
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === 'OPEN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : a.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#59413c] mt-1">
                      Host: <strong className="text-[#111c2d]">{a.creatorNickname}</strong> ·{' '}
                      {a.confirmedCount}/{a.maxParticipants} joined · {a.meetingPoint}
                    </p>
                  </div>
                  {['OPEN', 'FULL'].includes(a.status) && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({ type: 'cancel-activity', id: a._id, title: a.title })
                      }
                      disabled={busyId === a._id}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition disabled:opacity-60"
                    >
                      {busyId === a._id && <CircleNotch className="w-3 h-3 animate-spin" />}
                      {busyId === a._id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Reports Moderation Tab */}
        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-8 text-center text-xs font-semibold text-[#59413c] shadow-xs">
                No reports submitted for this hostel. Everything is peaceful!
              </div>
            ) : (
              reports.map((r) => (
                <div
                  key={r._id}
                  className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-5 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#111c2d]">{r.reason}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'OPEN'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-[#59413c]">{r.description}</p>}
                  <p className="text-[11px] text-slate-400">
                    Reported by {r.reporterNickname}
                    {r.reportedUser ? ` · User: ${r.reportedUser.nickname}` : ''}
                    {r.activity ? ` · Activity: ${r.activity.title}` : ''}
                  </p>
                  {r.status === 'OPEN' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => resolveReport(r._id, 'DISMISSED')}
                        disabled={busyId === r._id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-xs font-bold disabled:opacity-60"
                      >
                        {busyId === r._id ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle weight="duotone" className="w-3.5 h-3.5 text-emerald-700" />
                        )}
                        Dismiss
                      </button>
                      {r.activity && (
                        <button
                          type="button"
                          onClick={() =>
                            resolveReport(r._id, 'ACTION_TAKEN', { cancelActivity: true })
                          }
                          disabled={busyId === r._id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-60"
                        >
                          <XCircle weight="fill" className="w-3.5 h-3.5" /> Cancel Activity
                        </button>
                      )}
                      {r.reportedUser && (
                        <button
                          type="button"
                          onClick={() =>
                            resolveReport(r._id, 'ACTION_TAKEN', { restrictUser: true })
                          }
                          disabled={busyId === r._id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold disabled:opacity-60"
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

        {/* QR & Access Code Tab */}
        {tab === 'qr' && (
          <div className="grid md:grid-cols-2 gap-6">
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
                      onClick={copyQrUrl}
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
                      disabled={qrBusy}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold disabled:opacity-60 transition"
                    >
                      {qrBusy ? (
                        <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                      )}
                      {qrBusy ? 'Working...' : 'Regenerate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ type: 'revoke-qr' })}
                      disabled={qrBusy}
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
                    disabled={qrBusy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs disabled:opacity-60 transition"
                  >
                    {qrBusy && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                    {qrBusy ? 'Generating QR...' : 'Generate QR Code'}
                  </button>
                </div>
              )}
            </section>

            <section className="no-print bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Key weight="duotone" className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#111c2d]">Hostel Access Code</h2>
                  <p className="text-[11px] text-[#59413c]">
                    Embedded automatically inside your hostel QR URL
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
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/30 text-center text-xs font-semibold text-[#59413c]">
                  No active access code.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={regenerateCode}
                  disabled={qrBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs disabled:opacity-60 transition"
                >
                  {qrBusy ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                  )}
                  {qrBusy ? 'Generating...' : accessCode ? 'Regenerate Code' : 'Generate Code'}
                </button>
                {accessCode && (
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: 'revoke-code' })}
                    disabled={qrBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-60 transition"
                  >
                    <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke Code
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#e0bfb8]/35"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-[#111c2d]">
              {confirmModal.type === 'cancel-activity'
                ? 'Cancel Activity?'
                : confirmModal.type === 'revoke-qr'
                  ? 'Revoke Hostel QR?'
                  : 'Revoke Access Code?'}
            </h3>
            <p className="text-xs text-[#59413c] leading-relaxed">
              {confirmModal.type === 'cancel-activity'
                ? `Cancel "${confirmModal.title}"? Confirmed travellers will be notified.`
                : confirmModal.type === 'revoke-qr'
                  ? 'Travellers will no longer be able to scan this QR until you generate a new one.'
                  : 'New guests will not be able to join until you generate a fresh access code.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-full bg-[#f0f3ff] text-[#111c2d] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={qrBusy || busyId !== null}
                onClick={() => {
                  if (confirmModal.type === 'cancel-activity') void cancelActivity(confirmModal.id);
                  else if (confirmModal.type === 'revoke-qr') void revokeQr();
                  else void revokeCode();
                }}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {(qrBusy || busyId !== null) && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}
