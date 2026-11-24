import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SquaresFour,
  Compass,
  Medal,
  Flag,
  QrCode,
  Plus,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
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
  MapPin,
  Clock,
  SignOut,
  X,
  List,
  WarningCircle,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';

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

type ManagerSection = 'overview' | 'plans' | 'official' | 'reports' | 'qr';
type PlanFilter = 'ALL' | 'OFFICIAL' | 'GUEST';

function toLocalDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NAV_ITEMS: Array<{ id: ManagerSection; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: SquaresFour },
  { id: 'plans', label: 'Hostel Plans', icon: Compass },
  { id: 'official', label: 'Official Events', icon: Medal },
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'qr', label: 'QR & Access Code', icon: QrCode },
];

export function ManagerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);

  const [section, setSection] = useState<ManagerSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');
  const [search, setSearch] = useState('');

  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [activities, setActivities] = useState<ManagerActivity[]>([]);
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [qr, setQr] = useState<QrData | null>(null);
  const [accessCode, setAccessCode] = useState<AccessCodeData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Create Official Activity modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('SOCIAL');
  const [meetingPoint, setMeetingPoint] = useState('Rooftop Common Area');
  const [maxParticipants, setMaxParticipants] = useState(15);
  const [date, setDate] = useState(toLocalDateInput(defaultStart));
  const [startTime, setStartTime] = useState(toLocalTimeInput(defaultStart));
  const [endTime, setEndTime] = useState(toLocalTimeInput(defaultEnd));
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirm modal
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

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const generateQr = async () => {
    setQrBusy(true);
    try {
      await apiRequest('/staff/qr/generate', { method: 'POST' });
      await loadAll();
      showToast('Fresh Hostel QR code generated!');
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
      showToast('Access code regenerated!');
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
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyAccessCode = () => {
    if (!accessCode) return;
    void navigator.clipboard.writeText(accessCode.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const createOfficialActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
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
      setCreateModalOpen(false);
      showToast('Official hostel event published!');
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create activity');
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/staff/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const openReports = reports.filter((r) => r.status === 'OPEN');
  const officialActivities = activities.filter((a) => a.creatorType === 'HOSTEL_MANAGER');
  const guestActivities = activities.filter((a) => a.creatorType === 'TRAVELLER');

  const visiblePlans = activities.filter((a) => {
    if (section === 'official' && a.creatorType !== 'HOSTEL_MANAGER') return false;
    if (section === 'overview' || section === 'plans') {
      if (planFilter === 'OFFICIAL' && a.creatorType !== 'HOSTEL_MANAGER') return false;
      if (planFilter === 'GUEST' && a.creatorType !== 'TRAVELLER') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.creatorNickname.toLowerCase().includes(q) ||
        a.meetingPoint.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#062018] text-white">
      <div className="px-6 py-6">
        <p className="text-[17px] font-extrabold tracking-tight text-white">Common Ground</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400/80 mt-0.5">
          HOSTEL OPERATIONS PORTAL
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                active
                  ? 'bg-[#a93017] text-white shadow-xs'
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  weight={active ? 'fill' : 'duotone'}
                  className={`w-4 h-4 ${active ? 'text-white' : 'text-emerald-300/75'}`}
                />
                <span>{item.label}</span>
              </span>
              {item.id === 'reports' && openReports.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
                  {openReports.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70">
            Active Property
          </p>
          <p className="text-xs font-extrabold text-white truncate mt-0.5">
            {overview?.hostelName ?? 'Hostel Manager'}
          </p>
          <p className="text-[10px] text-emerald-200/70 truncate mt-0.5">
            {user?.nickname ?? 'Manager'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-emerald-100 transition disabled:opacity-60"
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
  );

  const renderPlanCard = (a: ManagerActivity) => {
    const isOfficial = a.creatorType === 'HOSTEL_MANAGER';
    const pct = Math.min(100, Math.round((a.confirmedCount / Math.max(1, a.maxParticipants)) * 100));
    const spotsLeft = Math.max(0, a.maxParticipants - a.confirmedCount);

    return (
      <div
        key={a._id}
        className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-5 shadow-2xs hover:shadow-sm transition space-y-3.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {isOfficial ? (
                <span className="px-2.5 py-0.5 rounded-full bg-[#a93017] text-white text-[10px] font-extrabold">
                  Official goSTOPS Event
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                  Backpacker Initiative
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  a.status === 'OPEN'
                    ? 'bg-[#ccf5e7] text-[#0b6b52]'
                    : a.status === 'CANCELLED'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {a.status}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#111c2d] leading-snug">{a.title}</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#59413c]">
              <span className="inline-flex items-center gap-1">
                <Clock weight="duotone" className="w-3.5 h-3.5 text-[#a93017]" />
                {new Date(a.scheduledAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin weight="duotone" className="w-3.5 h-3.5 text-[#a93017]" />
                {a.meetingPoint}
              </span>
              <span>
                Host: <strong className="text-[#111c2d]">{a.creatorNickname}</strong>
              </span>
            </div>
          </div>

          <div className="shrink-0 px-3 py-1.5 rounded-2xl bg-[#f0f3ff] text-center">
            <p className="text-sm font-extrabold text-[#111c2d]">
              {a.confirmedCount}/{a.maxParticipants}
            </p>
            <p className="text-[9px] font-bold uppercase text-[#59413c]">Seats</p>
          </div>
        </div>

        {/* Occupancy Progress Bar */}
        <div className="p-3 rounded-2xl bg-[#f9f9ff] border border-[#e0bfb8]/25 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#59413c]">Seat Occupancy</span>
            <span className="text-[#a93017]">
              {pct}% Full ({spotsLeft} spots left)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className={`h-full rounded-full transition-all ${
                isOfficial ? 'bg-[#a93017]' : 'bg-[#062018]'
              }`}
            />
          </div>
        </div>

        {['OPEN', 'FULL'].includes(a.status) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setConfirmModal({ type: 'cancel-activity', id: a._id, title: a.title })
              }
              disabled={busyId === a._id}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition disabled:opacity-60"
            >
              {busyId === a._id && <CircleNotch className="w-3 h-3 animate-spin" />}
              {busyId === a._id ? 'Cancelling...' : 'Cancel Event'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#f9f9ff] text-[#111c2d]">
      {/* Desktop Fixed Sidebar */}
      <aside className="no-print hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileNavOpen && (
        <div
          className="no-print fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-xs flex"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Bar */}
        <header className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#e0bfb8]/25 px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#f0f3ff] text-[#062018]"
              aria-label="Open menu"
            >
              <List weight="bold" className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2.5">
              <h1 className="text-sm sm:text-base font-extrabold text-[#111c2d] truncate">
                {overview?.hostelName ?? 'Hostel Manager'}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[11px] font-extrabold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {overview?.activeSessions ?? 0} In-House Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden md:block relative w-56">
              <MagnifyingGlass
                weight="bold"
                className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plans, hosts..."
                className="w-full pl-9 pr-3 py-2 rounded-full bg-[#f0f3ff] text-xs font-medium text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Plus weight="bold" className="w-3.5 h-3.5" />
              <span>Create Official Event</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {toast && (
            <div className="no-print p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          {/* OVERVIEW SECTION */}
          {section === 'overview' && (
            <>
              {/* Header + Filter Pills */}
              <div className="no-print flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ffdad3]/60 text-[#a93017] text-[10px] font-extrabold uppercase tracking-wider">
                    Live Hostel Operations
                  </span>
                  <h2 className="text-2xl font-extrabold text-[#111c2d] tracking-tight mt-1.5">
                    Hostel Command Center
                  </h2>
                  <p className="text-xs text-[#59413c] mt-0.5">
                    Real-time guest plans, official events, moderation, and common-room QR check-in.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'ALL' as PlanFilter, label: `All (${activities.length})` },
                    { key: 'OFFICIAL' as PlanFilter, label: `Official (${officialActivities.length})` },
                    { key: 'GUEST' as PlanFilter, label: `Guest Hosted (${guestActivities.length})` },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setPlanFilter(f.key)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                        planFilter === f.key
                          ? 'bg-[#a93017] text-white shadow-xs'
                          : 'bg-white border border-[#e0bfb8]/40 text-[#59413c] hover:bg-[#f0f3ff]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  {openReports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSection('reports')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      Flagged ({openReports.length})
                    </button>
                  )}
                </div>
              </div>

              {/* 4 KPI Bento Cards */}
              <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#59413c]">
                      Active In-House
                    </p>
                    <div className="w-8 h-8 rounded-full bg-[#ccf5e7] text-[#0b6b52] flex items-center justify-center">
                      <UsersThree weight="duotone" className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-[#111c2d]">
                    {overview?.activeSessions ?? '—'}
                  </p>
                  <p className="text-[11px] font-semibold text-[#59413c]">
                    {overview?.realMetrics.travellersOnboarded ?? 0} total onboarded
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#59413c]">
                      Live Plans &amp; Hangouts
                    </p>
                    <div className="w-8 h-8 rounded-full bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                      <CalendarCheck weight="duotone" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-[#111c2d]">
                      {overview?.activeActivities ?? '—'}
                    </p>
                    <span className="text-[11px] font-bold text-emerald-600">● Active</span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#59413c]">
                    {officialActivities.length} Official · {guestActivities.length} Guest-led
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#59413c]">
                      Flagged Reports
                    </p>
                    <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Flag weight="duotone" className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-rose-600">
                    {overview?.openReports ?? '—'}
                  </p>
                  <p className="text-[11px] font-semibold text-[#59413c]">
                    {openReports.length > 0 ? 'Requires desk review' : 'All clear today'}
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#59413c]">
                      Real Activity Joins
                    </p>
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Sparkle weight="duotone" className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-[#a93017]">
                    {overview?.realMetrics.activitiesJoined ?? '—'}
                  </p>
                  <p className="text-[11px] font-semibold text-[#59413c]">
                    {overview?.realMetrics.qrScans ?? 0} QR scans recorded
                  </p>
                </div>
              </div>

              {/* 2-Column Main Operations Area */}
              <div className="grid lg:grid-cols-12 gap-6 items-start">
                {/* Left: Active Hostel Plans */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-white rounded-2xl border border-[#e0bfb8]/25 px-5 py-3.5 flex items-center justify-between shadow-2xs">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#111c2d]">
                        Active Hostel Plans &amp; Moderation
                      </h3>
                      <p className="text-[11px] text-[#59413c]">
                        Monitor occupancy and manage official or guest-hosted plans
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('plans')}
                      className="text-xs font-bold text-[#a93017] hover:underline shrink-0"
                    >
                      View all →
                    </button>
                  </div>

                  {visiblePlans.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-10 text-center space-y-3">
                      <p className="text-sm font-bold text-[#111c2d]">No plans match this filter</p>
                      <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold"
                      >
                        Create Official Event
                      </button>
                    </div>
                  ) : (
                    visiblePlans.slice(0, 5).map(renderPlanCard)
                  )}
                </div>

                {/* Right: Live QR Terminal + Community Alerts */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Dark Emerald Common Room Check-In QR Card */}
                  <div className="rounded-3xl bg-[#062018] text-white p-5 shadow-md space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live Terminal
                      </span>
                      <button
                        type="button"
                        onClick={() => setSection('qr')}
                        className="text-emerald-300 hover:underline"
                      >
                        Full Desk →
                      </button>
                    </div>

                    <div className="text-center">
                      <h3 className="text-base font-extrabold">Common Room Check-In</h3>
                      <p className="text-[11px] text-emerald-200/70 mt-0.5">
                        Guests scan to join verified chats &amp; plans
                      </p>
                    </div>

                    {qr ? (
                      <>
                        <div className="bg-white rounded-2xl p-3.5 flex flex-col items-center">
                          <img
                            src={qr.qrDataUrl}
                            alt="Hostel QR"
                            className="w-44 h-44 object-contain"
                          />
                          <p className="text-[10px] font-extrabold tracking-widest uppercase text-[#062018] mt-1">
                            {overview?.hostelName}
                          </p>
                        </div>

                        {accessCode && (
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/10">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70">
                                Backup Code
                              </p>
                              <p className="text-sm font-extrabold font-mono tracking-widest text-emerald-300">
                                {accessCode.code}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={copyAccessCode}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200"
                              title="Copy code"
                            >
                              {copiedCode ? (
                                <Check weight="bold" className="w-4 h-4 text-emerald-300" />
                              ) : (
                                <Copy weight="duotone" className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        <p className="text-center text-[11px] font-semibold text-emerald-300/80">
                          {qr.scanCount} scans recorded
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={qr.qrDataUrl}
                            download="common-ground-qr.png"
                            className="py-2 rounded-full bg-white text-[#062018] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-50 transition"
                          >
                            <DownloadSimple weight="bold" className="w-3.5 h-3.5" />
                            PNG
                          </a>
                          <button
                            type="button"
                            onClick={() => setSection('qr')}
                            className="py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                          >
                            <Printer weight="duotone" className="w-3.5 h-3.5" />
                            Standee
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center space-y-3">
                        <p className="text-xs text-emerald-200/75">No active QR generated yet.</p>
                        <button
                          type="button"
                          onClick={generateQr}
                          disabled={qrBusy}
                          className="px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold"
                        >
                          {qrBusy ? 'Generating...' : 'Generate QR'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Community Alerts Card */}
                  <div className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#111c2d] flex items-center gap-1.5">
                        <WarningCircle weight="duotone" className="w-4 h-4 text-[#a93017]" />
                        Community Alerts
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          openReports.length > 0
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-[#ccf5e7] text-[#0b6b52]'
                        }`}
                      >
                        {openReports.length} Active
                      </span>
                    </div>

                    {openReports.length === 0 ? (
                      <p className="text-xs text-[#59413c] py-2">
                        No open reports. Common room vibes are smooth!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {openReports.slice(0, 3).map((r) => (
                          <div
                            key={r._id}
                            className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/70 space-y-1"
                          >
                            <p className="text-xs font-extrabold text-rose-900">{r.reason}</p>
                            <p className="text-[11px] text-rose-800/80 line-clamp-2">
                              {r.description || `Reported by ${r.reporterNickname}`}
                            </p>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSection('reports')}
                          className="w-full py-2 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-xs font-bold"
                        >
                          Review All Reports →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PLANS & OFFICIAL EVENTS SECTIONS */}
          {(section === 'plans' || section === 'official') && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#111c2d]">
                    {section === 'official' ? 'Official Hostel Events' : 'All Hostel Plans'}
                  </h2>
                  <p className="text-xs text-[#59413c]">
                    {visiblePlans.length} events in {overview?.hostelName}
                  </p>
                </div>
                {section === 'plans' && (
                  <div className="flex gap-1.5">
                    {(['ALL', 'OFFICIAL', 'GUEST'] as PlanFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPlanFilter(f)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
                          planFilter === f
                            ? 'bg-[#062018] text-emerald-300'
                            : 'bg-white border border-[#e0bfb8]/40 text-[#59413c]'
                        }`}
                      >
                        {f === 'ALL' ? 'All' : f === 'OFFICIAL' ? 'Official' : 'Guest'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {visiblePlans.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-10 text-center text-xs font-semibold text-[#59413c]">
                  No activities found.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">{visiblePlans.map(renderPlanCard)}</div>
              )}
            </div>
          )}

          {/* REPORTS SECTION */}
          {section === 'reports' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#111c2d]">
                  Moderation &amp; Safety Reports
                </h2>
                <p className="text-xs text-[#59413c]">
                  {openReports.length} open · {reports.length} total reports
                </p>
              </div>

              {reports.length === 0 ? (
                <div className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-10 text-center text-xs font-semibold text-[#59413c]">
                  No reports submitted for this hostel.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div
                      key={r._id}
                      className="bg-white rounded-3xl border border-[#e0bfb8]/30 p-5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#111c2d]">{r.reason}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            r.status === 'OPEN'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-[#ccf5e7] text-[#0b6b52]'
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
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-xs font-bold disabled:opacity-60"
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
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-60"
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
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#062018] hover:bg-[#14241E] text-emerald-300 text-xs font-bold disabled:opacity-60"
                            >
                              Restrict User
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QR & ACCESS CODE SECTION (Print-Ready Standee + Passkey) */}
          {section === 'qr' && (
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              <section className="lg:col-span-7 bg-white rounded-3xl border border-[#e0bfb8]/30 p-6 space-y-5 shadow-2xs">
                <div className="no-print flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-[#111c2d]">
                        Lobby QR Standee &amp; Digital Poster
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[10px] font-extrabold">
                        PRINT-READY A4/A5
                      </span>
                    </div>
                    <p className="text-xs text-[#59413c] mt-0.5">
                      Scanned by travellers at reception to join {overview?.hostelName}
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
                        <span className="px-2 py-0.5 rounded bg-white/10">FRONT DESK</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#e66a4e]">
                          Connect with Solo Backpackers
                        </p>
                        <h3 className="text-2xl font-extrabold mt-1">Scan to Join Common Ground</h3>
                        <p className="text-xs text-emerald-100/75 mt-1 max-w-sm mx-auto">
                          Discover in-house travellers, join rooftop chai, board games, and live
                          hostel hangouts.
                        </p>
                      </div>
                      <div className="inline-block bg-white p-4 rounded-3xl shadow-lg">
                        <img
                          src={qr.qrDataUrl}
                          alt="Hostel QR Standee"
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
                        onClick={copyQrUrl}
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
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold"
                      >
                        <DownloadSimple weight="bold" className="w-3.5 h-3.5" /> Download PNG
                      </a>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold"
                      >
                        <Printer weight="duotone" className="w-3.5 h-3.5" /> Print Poster
                      </button>
                      <button
                        type="button"
                        onClick={generateQr}
                        disabled={qrBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold disabled:opacity-60"
                      >
                        {qrBusy ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                        )}
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmModal({ type: 'revoke-qr' })}
                        disabled={qrBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-60"
                      >
                        <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-xs font-semibold text-[#59413c]">No active QR code yet.</p>
                    <button
                      type="button"
                      onClick={generateQr}
                      disabled={qrBusy}
                      className="px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold"
                    >
                      {qrBusy ? 'Generating...' : 'Generate QR Code'}
                    </button>
                  </div>
                )}
              </section>

              {/* Right: Front Desk Passkey Card */}
              <section className="no-print lg:col-span-5 bg-white rounded-3xl border border-[#e0bfb8]/30 p-6 space-y-4 shadow-2xs">
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
                      Auto-embedded in QR · Guests can also type it manually
                    </p>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#f9f9ff] text-center text-xs font-semibold text-[#59413c]">
                    No active access code.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  {accessCode && (
                    <button
                      type="button"
                      onClick={copyAccessCode}
                      className="py-2.5 rounded-xl bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
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
                    disabled={qrBusy}
                    className={`${
                      accessCode ? '' : 'col-span-2'
                    } py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#111c2d] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60`}
                  >
                    {qrBusy ? (
                      <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowsClockwise weight="bold" className="w-3.5 h-3.5" />
                    )}
                    {accessCode ? 'Regenerate' : 'Generate Code'}
                  </button>
                </div>

                {accessCode && (
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: 'revoke-code' })}
                    disabled={qrBusy}
                    className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Prohibit weight="duotone" className="w-3.5 h-3.5" /> Revoke Access Code
                  </button>
                )}

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                  Changing this code updates your QR link automatically. Regenerate during shift
                  handovers or security resets.
                </div>
              </section>
            </div>
          )}
        </main>

        <Footer />
      </div>

      {/* Create Official Event Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#062018]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <form
            onSubmit={createOfficialActivity}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#e0bfb8]/35 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                  <Medal weight="duotone" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#111c2d]">
                    Create Official Hostel Event
                  </h3>
                  <p className="text-[11px] text-[#59413c]">
                    Pinned with an Official badge on every guest&apos;s radar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1">Event Name</label>
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Rooftop UNO & Masala Chai Night"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1">Description</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the official hostel event..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">Category</label>
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
                <label className="block text-xs font-bold text-[#111c2d] mb-1">
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
                <label className="block text-xs font-bold text-[#111c2d] mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">Start</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">End</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1">Meeting Point</label>
              <input
                required
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="Rooftop Common Area"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingActivity}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold disabled:opacity-60"
              >
                {creatingActivity && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                {creatingActivity ? 'Publishing...' : 'Publish Official Event'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 bg-[#062018]/50 backdrop-blur-xs flex items-center justify-center p-4"
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
    </div>
  );
}
