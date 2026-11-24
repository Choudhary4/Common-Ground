import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SquaresFour,
  Buildings,
  UsersThree,
  ChartBar,
  ClipboardText,
  Plus,
  QrCode,
  UserPlus,
  CalendarCheck,
  MagnifyingGlass,
  CircleNotch,
  Eye,
  EyeSlash,
  SignOut,
  X,
  CheckCircle,
  TrendUp,
  User,
  List,
} from '@phosphor-icons/react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';

interface HostelMetricRow {
  hostelId: string;
  name: string;
  city: string;
  status?: string;
  isDemo: boolean;
  qrScans: number;
  travellersOnboarded: number;
  activitiesCreated: number;
  activitiesJoined: number;
  activitiesCompleted: number;
  thisWeekEvents?: number;
  lastWeekEvents?: number;
}

interface AdminOverview {
  activeHostels: number;
  managers: number;
  staff: number;
  realMetrics: {
    travellersOnboarded: number;
    activitiesCreated: number;
    qrScans: number;
    activitiesJoined: number;
    activitiesCompleted: number;
  };
  hostelBreakdown: HostelMetricRow[];
}

interface HostelRow {
  _id: string;
  name: string;
  city: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
  isDemo: boolean;
}

interface StaffRow {
  id: string;
  nickname: string;
  email: string;
  role: string;
  hostelName: string | null;
  status: 'ACTIVE' | 'DISABLED';
}

interface AuditRow {
  _id: string;
  action: string;
  actorRole: string;
  actorName: string;
  hostelName: string | null;
  targetType: string;
  createdAt: string;
}

type AdminSection = 'overview' | 'properties' | 'managers' | 'analytics' | 'audit';

const NAV_ITEMS: Array<{ id: AdminSection; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: SquaresFour },
  { id: 'properties', label: 'Properties', icon: Buildings },
  { id: 'managers', label: 'Hostel Managers', icon: UsersThree },
  { id: 'analytics', label: 'Analytics', icon: ChartBar },
  { id: 'audit', label: 'Audit', icon: ClipboardText },
];

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState('');

  // Modals
  const [addHostelOpen, setAddHostelOpen] = useState(false);
  const [addManagerOpen, setAddManagerOpen] = useState(false);

  // Forms
  const [hName, setHName] = useState('');
  const [hCity, setHCity] = useState('');
  const [hAddr, setHAddr] = useState('');

  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPass, setSPass] = useState('');
  const [sHostelId, setSHostelId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creatingHostel, setCreatingHostel] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    const [ov, hRes, sRes, aRes] = await Promise.all([
      apiRequest<AdminOverview>('/admin/overview'),
      apiRequest<{ hostels: HostelRow[] }>('/admin/hostels'),
      apiRequest<{ staff: StaffRow[] }>('/admin/staff'),
      apiRequest<{ logs: AuditRow[] }>('/admin/audit').catch(() => ({ logs: [] })),
    ]);
    setOverview(ov);
    setHostels(hRes.hostels);
    setStaff(sRes.staff);
    setAuditLogs(aRes.logs);
    if (hRes.hostels.length > 0 && !sHostelId) {
      setSHostelId(hRes.hostels[0]._id);
    }
  }, [sHostelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const createHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatingHostel(true);
    try {
      await apiRequest('/admin/hostels', {
        method: 'POST',
        body: JSON.stringify({ name: hName, city: hCity, address: hAddr }),
      });
      setHName('');
      setHCity('');
      setHAddr('');
      setAddHostelOpen(false);
      showToast('Hostel property created!');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create hostel');
    } finally {
      setCreatingHostel(false);
    }
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatingManager(true);
    try {
      await apiRequest('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          nickname: sName,
          email: sEmail,
          password: sPass,
          role: 'HOSTEL_MANAGER',
          hostelId: sHostelId,
        }),
      });
      setSName('');
      setSEmail('');
      setSPass('');
      setAddManagerOpen(false);
      showToast('Hostel Manager account created!');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create manager');
    } finally {
      setCreatingManager(false);
    }
  };

  const toggleHostelStatus = async (h: HostelRow) => {
    setTogglingId(h._id);
    try {
      await apiRequest(`/admin/hostels/${h._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: h.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
      });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const toggleStaffStatus = async (s: StaffRow) => {
    setTogglingId(s.id);
    try {
      await apiRequest(`/admin/staff/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      });
      await load();
    } finally {
      setTogglingId(null);
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

  const breakdown = overview?.hostelBreakdown ?? [];
  const filteredBreakdown = breakdown.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.city.toLowerCase().includes(search.toLowerCase())
  );

  // Weekly Cohort Bar Chart data (uses real per-hostel weekly events, falling back to real joins/travellers)
  const chartRows = breakdown.slice(0, 6).map((row) => ({
    label: row.name,
    thisWeek: row.thisWeekEvents ?? row.travellersOnboarded + row.activitiesJoined,
    lastWeek: row.lastWeekEvents ?? 0,
  }));
  const maxChartVal = Math.max(
    10,
    ...chartRows.flatMap((r) => [r.thisWeek, r.lastWeek])
  );
  const yTicks = [
    maxChartVal,
    Math.round(maxChartVal * 0.75),
    Math.round(maxChartVal * 0.5),
    Math.round(maxChartVal * 0.25),
    0,
  ];

  const sectionTitle =
    section === 'overview'
      ? 'Central HQ · Real Adoption'
      : section === 'properties'
        ? 'Central HQ · Properties'
        : section === 'managers'
          ? 'Central HQ · Hostel Managers'
          : section === 'analytics'
            ? 'Central HQ · Analytics'
            : 'Central HQ · Audit Log';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#062018] text-white">
      <div className="px-6 py-6">
        <p className="text-[17px] font-extrabold tracking-tight text-white">Common Ground</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400/80 mt-0.5">
          BY GOSTOPS
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                active
                  ? 'bg-[#0e4438] text-white shadow-xs'
                  : 'text-emerald-100/65 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon
                weight={active ? 'fill' : 'duotone'}
                className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-emerald-300/70'}`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="px-2">
          <p className="text-xs font-bold text-white truncate">{user?.nickname ?? 'Central Admin'}</p>
          <p className="text-[10px] text-emerald-300/70 truncate">{user?.email}</p>
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

  return (
    <div className="min-h-screen flex bg-[#f9f9ff] text-[#111c2d]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/50 backdrop-blur-xs flex"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Right Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#e0bfb8]/25 px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#f0f3ff] text-[#14241E]"
              aria-label="Open menu"
            >
              <List weight="bold" className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-extrabold text-[#111c2d] truncate">
              {sectionTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setAddHostelOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Plus weight="bold" className="w-3.5 h-3.5" />
              <span>Add Hostel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setAddManagerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Plus weight="bold" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Manager</span>
              <span className="sm:hidden">Manager</span>
            </button>
            <div className="hidden sm:flex w-9 h-9 rounded-full bg-[#a93017] text-white items-center justify-center shadow-xs">
              <User weight="fill" className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {toast && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-2xs">
              <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          {/* OVERVIEW & ANALYTICS KPI ROW */}
          {(section === 'overview' || section === 'analytics') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {[
                {
                  label: 'QR Scans',
                  value: overview?.realMetrics.qrScans ?? 0,
                  icon: QrCode,
                  chip: 'Real scans',
                },
                {
                  label: 'Travellers Joined',
                  value: overview?.realMetrics.travellersOnboarded ?? 0,
                  icon: UserPlus,
                  chip: 'Non-demo',
                },
                {
                  label: 'Activities Created',
                  value: overview?.realMetrics.activitiesCreated ?? 0,
                  icon: CalendarCheck,
                  chip: 'Hostel plans',
                },
                {
                  label: 'Real Activity Joins',
                  value: overview?.realMetrics.activitiesJoined ?? 0,
                  icon: UsersThree,
                  chip: 'Confirmed',
                },
                {
                  label: 'Active Hostels',
                  value: overview?.activeHostels ?? 0,
                  icon: Buildings,
                  chip: `${overview?.managers ?? 0} mgrs`,
                },
              ].map((kpi) => {
                const KpiIcon = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className="bg-white rounded-2xl border border-[#e0bfb8]/25 p-4 sm:p-5 shadow-2xs hover:shadow-sm transition flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-[#59413c] truncate">{kpi.label}</p>
                      <KpiIcon weight="duotone" className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-2xl sm:text-3xl font-extrabold text-[#111c2d] tracking-tight">
                        {kpi.value.toLocaleString()}
                      </p>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ccf5e7] text-[#0b6b52] text-[10px] font-extrabold shrink-0">
                        <TrendUp weight="bold" className="w-2.5 h-2.5" />
                        {kpi.chip}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 01 · WEEKLY COHORT BAR CHART */}
          {(section === 'overview' || section === 'analytics') && (
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 sm:p-7 shadow-2xs space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
                    01 · WEEKLY COHORT{' '}
                    <span className="text-[#59413c] font-semibold normal-case tracking-normal">
                      · Last 7 Days
                    </span>
                  </p>
                  <h2 className="text-lg font-extrabold text-[#111c2d] mt-0.5">
                    Weekly Real Traveller Adoption
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-[#111c2d]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#a93017]" />
                    This Week
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#062018]" />
                    Last Week
                  </span>
                </div>
              </div>

              {chartRows.length === 0 ? (
                <p className="py-10 text-center text-xs font-semibold text-[#59413c]">
                  Add a hostel property to start tracking real adoption metrics.
                </p>
              ) : (
                <div className="flex gap-4 items-end pt-2">
                  {/* Y-axis ticks */}
                  <div className="hidden sm:flex flex-col justify-between h-52 text-[10px] font-semibold text-slate-400 pr-2 text-right">
                    {yTicks.map((t, i) => (
                      <span key={i}>{t}</span>
                    ))}
                  </div>

                  {/* Grouped Bars */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 items-end h-52 border-b border-slate-100 pb-1">
                    {chartRows.map((row) => {
                      const thisPct = Math.max(6, Math.round((row.thisWeek / maxChartVal) * 100));
                      const lastPct = Math.max(4, Math.round((row.lastWeek / maxChartVal) * 100));
                      return (
                        <div key={row.label} className="flex flex-col items-center h-full justify-end group">
                          <div className="flex items-end gap-2 h-full w-full justify-center">
                            <div
                              title={`This Week: ${row.thisWeek}`}
                              style={{ height: `${thisPct}%` }}
                              className="w-6 sm:w-7 rounded-t-xl bg-[#a93017] transition-all duration-300 group-hover:bg-[#cb482c] relative"
                            >
                              <span className="sr-only">{row.thisWeek}</span>
                            </div>
                            <div
                              title={`Last Week: ${row.lastWeek}`}
                              style={{ height: `${lastPct}%` }}
                              className="w-6 sm:w-7 rounded-t-xl bg-[#062018] transition-all duration-300 group-hover:bg-[#14241E]"
                            >
                              <span className="sr-only">{row.lastWeek}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {chartRows.length > 0 && (
                <div className="sm:pl-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 text-center">
                  {chartRows.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <p className="text-xs font-bold text-[#111c2d] truncate">{row.label}</p>
                      <p className="text-[10px] font-semibold text-[#59413c]">
                        {row.thisWeek} vs {row.lastWeek}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 02 · PROPERTY BREAKDOWN TABLE */}
          {(section === 'overview' || section === 'analytics') && (
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 sm:p-7 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
                    02 · PROPERTY BREAKDOWN
                  </p>
                  <h2 className="text-lg font-extrabold text-[#111c2d] mt-0.5">
                    Hostel-wise Real Adoption
                  </h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlass
                    weight="bold"
                    className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter property or city..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#f0f3ff] text-xs font-medium text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#f4f6fc] text-[10px] font-extrabold uppercase tracking-wider text-[#59413c]">
                      <th className="py-3 px-4 rounded-l-xl">Property Name</th>
                      <th className="py-3 px-3">City</th>
                      <th className="py-3 px-3 text-right">QR Scans</th>
                      <th className="py-3 px-3 text-right">Travellers Joined</th>
                      <th className="py-3 px-3 text-right">Activities</th>
                      <th className="py-3 px-3 text-right">Joins</th>
                      <th className="py-3 px-3 text-center">Completion Rate</th>
                      <th className="py-3 px-4 rounded-r-xl text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-[#59413c] font-semibold">
                          No matching hostels found.
                        </td>
                      </tr>
                    ) : (
                      filteredBreakdown.map((row) => {
                        const rate =
                          row.activitiesCreated > 0
                            ? Math.round((row.activitiesCompleted / row.activitiesCreated) * 100)
                            : 0;
                        const isHigh = rate >= 70;
                        const isActive = (row.status ?? 'ACTIVE') === 'ACTIVE';
                        return (
                          <tr key={row.hostelId} className="hover:bg-[#f9f9ff] transition">
                            <td className="py-3.5 px-4 font-extrabold text-[#111c2d]">
                              {row.name}
                              {row.isDemo && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                  Demo
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-[#59413c] font-medium">{row.city}</td>
                            <td className="py-3.5 px-3 text-right font-bold text-[#111c2d]">
                              {row.qrScans}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-[#111c2d]">
                              {row.travellersOnboarded}
                            </td>
                            <td className="py-3.5 px-3 text-right font-semibold text-[#59413c]">
                              {row.activitiesCreated}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-[#111c2d]">
                              {row.activitiesJoined}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                  isHigh
                                    ? 'bg-[#ccf5e7] text-[#0b6b52]'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {rate}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                                  isActive ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                />
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* PROPERTIES SECTION */}
          {section === 'properties' && (
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 sm:p-7 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
                    PROPERTIES DIRECTORY
                  </p>
                  <h2 className="text-lg font-extrabold text-[#111c2d] mt-0.5">
                    All Hostel Properties ({hostels.length})
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {hostels.map((h) => (
                  <div
                    key={h._id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-[#111c2d]">{h.name}</p>
                        <span className="text-xs font-medium text-[#59413c]">· {h.city}</span>
                        {h.isDemo && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{h.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          h.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            h.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {h.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleHostelStatus(h)}
                        disabled={togglingId === h._id}
                        className="px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-[11px] font-bold disabled:opacity-60"
                      >
                        {togglingId === h._id
                          ? '...'
                          : h.status === 'ACTIVE'
                            ? 'Set Inactive'
                            : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* HOSTEL MANAGERS SECTION */}
          {section === 'managers' && (
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 sm:p-7 shadow-2xs space-y-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
                  TEAM ACCOUNTS
                </p>
                <h2 className="text-lg font-extrabold text-[#111c2d] mt-0.5">
                  Hostel Managers &amp; Staff ({staff.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <div
                    key={s.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-[#111c2d]">
                        {s.nickname}{' '}
                        <span className="font-medium text-xs text-[#59413c]">({s.email})</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.role.replace('_', ' ')} · {s.hostelName ?? 'All Properties'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {s.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStaffStatus(s)}
                        disabled={togglingId === s.id}
                        className="px-3 py-1 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-[11px] font-bold disabled:opacity-60"
                      >
                        {togglingId === s.id
                          ? '...'
                          : s.status === 'ACTIVE'
                            ? 'Disable'
                            : 'Enable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AUDIT LOG SECTION */}
          {section === 'audit' && (
            <section className="bg-white rounded-3xl border border-[#e0bfb8]/25 p-5 sm:p-7 shadow-2xs space-y-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
                  SECURITY &amp; OPERATIONS
                </p>
                <h2 className="text-lg font-extrabold text-[#111c2d] mt-0.5">
                  Recent Audit Events ({auditLogs.length})
                </h2>
              </div>
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-xs font-semibold text-[#59413c]">
                  No audit events recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {auditLogs.map((l) => (
                    <div
                      key={l._id}
                      className="py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f0f3ff] text-[#14241E] font-extrabold text-[10px]">
                          {l.action}
                        </span>
                        <span className="font-bold text-[#111c2d]">{l.actorName}</span>
                        <span className="text-[#59413c]">
                          ({l.actorRole.replace('_', ' ')})
                          {l.hostelName ? ` · ${l.hostelName}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(l.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        <Footer />
      </div>

      {/* Add Hostel Modal */}
      {addHostelOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#062018]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAddHostelOpen(false)}
        >
          <form
            onSubmit={createHostel}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#e0bfb8]/35"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f0f3ff] text-[#062018] flex items-center justify-center">
                  <Buildings weight="duotone" className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-[#111c2d]">Add Hostel Property</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddHostelOpen(false)}
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

            <div className="space-y-3">
              <input
                required
                value={hName}
                onChange={(e) => setHName(e.target.value)}
                placeholder="Hostel Name (e.g., goSTOPS Manali)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
              <input
                required
                value={hCity}
                onChange={(e) => setHCity(e.target.value)}
                placeholder="City"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
              <input
                required
                value={hAddr}
                onChange={(e) => setHAddr(e.target.value)}
                placeholder="Full address"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddHostelOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingHostel}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#062018] hover:bg-[#14241E] text-white text-xs font-bold disabled:opacity-60"
              >
                {creatingHostel && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                {creatingHostel ? 'Creating...' : 'Create Hostel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Hostel Manager Modal */}
      {addManagerOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#062018]/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAddManagerOpen(false)}
        >
          <form
            onSubmit={createStaff}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#e0bfb8]/35"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                  <UserPlus weight="duotone" className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-[#111c2d]">Add Hostel Manager</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddManagerOpen(false)}
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

            <div className="space-y-3">
              <input
                required
                value={sName}
                onChange={(e) => setSName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
              <input
                type="email"
                required
                value={sEmail}
                onChange={(e) => setSEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={sPass}
                  onChange={(e) => setSPass(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
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
              <select
                value={sHostelId}
                onChange={(e) => setSHostelId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
              >
                {hostels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddManagerOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingManager}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold disabled:opacity-60"
              >
                {creatingManager && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                {creatingManager ? 'Creating...' : 'Create Manager'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
