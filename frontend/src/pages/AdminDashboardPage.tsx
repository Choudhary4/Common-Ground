import React, { useCallback, useEffect, useState } from 'react';
import {
  Buildings,
  UserPlus,
  CircleNotch,
  Eye,
  EyeSlash,
  QrCode,
  UsersThree,
  CalendarCheck,
  Sparkle,
  ChartBar,
  CheckCircle,
} from '@phosphor-icons/react';
import { StaffLayout } from '../components/StaffLayout';
import { apiRequest, ApiError } from '../lib/api';

interface HostelMetricRow {
  hostelId: string;
  name: string;
  city: string;
  isDemo: boolean;
  qrScans: number;
  travellersOnboarded: number;
  activitiesCreated: number;
  activitiesJoined: number;
  activitiesCompleted: number;
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
  status: string;
  isDemo: boolean;
}

interface StaffRow {
  id: string;
  nickname: string;
  email: string;
  role: string;
  hostelName: string | null;
  status: string;
}

export function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [hostels, setHostels] = useState<HostelRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [hName, setHName] = useState('');
  const [hCity, setHCity] = useState('');
  const [hAddr, setHAddr] = useState('');

  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPass, setSPass] = useState('');
  const [sHostelId, setSHostelId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [creatingHostel, setCreatingHostel] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    const [ov, hRes, sRes] = await Promise.all([
      apiRequest<AdminOverview>('/admin/overview'),
      apiRequest<{ hostels: HostelRow[] }>('/admin/hostels'),
      apiRequest<{ staff: StaffRow[] }>('/admin/staff'),
    ]);
    setOverview(ov);
    setHostels(hRes.hostels);
    setStaff(sRes.staff);
    if (hRes.hostels.length > 0 && !sHostelId) {
      setSHostelId(hRes.hostels[0]._id);
    }
  }, [sHostelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setCreatingHostel(true);
    try {
      await apiRequest('/admin/hostels', {
        method: 'POST',
        body: JSON.stringify({ name: hName, city: hCity, address: hAddr }),
      });
      setHName('');
      setHCity('');
      setHAddr('');
      setMsg('Hostel property created!');
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to create hostel');
    } finally {
      setCreatingHostel(false);
    }
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
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
      setMsg('Hostel Manager account created!');
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Failed to create manager');
    } finally {
      setCreatingManager(false);
    }
  };

  return (
    <StaffLayout title="Central Admin" subtitle="Platform Properties, Managers & Real Adoption">
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">QR Scans</p>
              <QrCode weight="duotone" className="w-4 h-4 text-[#a93017]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.realMetrics.qrScans ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Travellers</p>
              <UsersThree weight="duotone" className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1.5">
              {overview?.realMetrics.travellersOnboarded ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Activities</p>
              <CalendarCheck weight="duotone" className="w-4 h-4 text-[#14241E]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.realMetrics.activitiesCreated ?? '—'}
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
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#59413c]">Active Hostels</p>
              <Buildings weight="duotone" className="w-4 h-4 text-[#a93017]" />
            </div>
            <p className="text-2xl font-extrabold text-[#111c2d] mt-1.5">
              {overview?.activeHostels ?? '—'}
            </p>
          </div>
        </div>

        {/* Hostel-wise Breakdown Table */}
        {overview?.hostelBreakdown && overview.hostelBreakdown.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 shadow-xs overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <ChartBar weight="duotone" className="w-5 h-5 text-[#a93017]" />
              <h3 className="text-sm font-extrabold text-[#111c2d]">
                Hostel-wise Real Adoption (Excludes Demo Data)
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e0bfb8]/30 text-[#59413c]">
                  <th className="py-2.5 pr-4 font-bold">Hostel</th>
                  <th className="py-2.5 px-3 font-bold">QR Scans</th>
                  <th className="py-2.5 px-3 font-bold">Travellers</th>
                  <th className="py-2.5 px-3 font-bold">Activities</th>
                  <th className="py-2.5 px-3 font-bold">Joins</th>
                  <th className="py-2.5 pl-3 font-bold">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.hostelBreakdown.map((row) => (
                  <tr key={row.hostelId} className="hover:bg-[#f9f9ff]">
                    <td className="py-3 pr-4 font-bold text-[#111c2d]">
                      {row.name}{' '}
                      <span className="font-medium text-[#59413c]">· {row.city}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold">{row.qrScans}</td>
                    <td className="py-3 px-3 font-extrabold text-emerald-700">
                      {row.travellersOnboarded}
                    </td>
                    <td className="py-3 px-3 font-semibold">{row.activitiesCreated}</td>
                    <td className="py-3 px-3 font-semibold">{row.activitiesJoined}</td>
                    <td className="py-3 pl-3 font-semibold">{row.activitiesCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {msg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {/* Creation Forms */}
        <div className="grid md:grid-cols-2 gap-6">
          <form
            onSubmit={createHostel}
            className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 space-y-3.5 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center">
                <Buildings weight="duotone" className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-extrabold text-[#111c2d]">Add Hostel Property</h2>
            </div>
            <input
              required
              value={hName}
              onChange={(e) => setHName(e.target.value)}
              placeholder="goSTOPS Manali"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
            <input
              required
              value={hCity}
              onChange={(e) => setHCity(e.target.value)}
              placeholder="City"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
            <input
              required
              value={hAddr}
              onChange={(e) => setHAddr(e.target.value)}
              placeholder="Full address"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
            <button
              type="submit"
              disabled={creatingHostel}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-60"
            >
              {creatingHostel && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
              {creatingHostel ? 'Creating Hostel...' : 'Create Hostel'}
            </button>
          </form>

          <form
            onSubmit={createStaff}
            className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 space-y-3.5 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center">
                <UserPlus weight="duotone" className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-extrabold text-[#111c2d]">Add Hostel Manager</h2>
            </div>
            <input
              required
              value={sName}
              onChange={(e) => setSName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
            <input
              type="email"
              required
              value={sEmail}
              onChange={(e) => setSEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={sPass}
                onChange={(e) => setSPass(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
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
            <button
              type="submit"
              disabled={creatingManager}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-60"
            >
              {creatingManager && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
              {creatingManager ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Hostels & Team Accounts Lists */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#111c2d] mb-3">
              Hostels ({hostels.length})
            </h3>
            <div className="divide-y divide-slate-100 text-sm">
              {hostels.map((h) => (
                <div key={h._id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-[#111c2d]">{h.name}</span>{' '}
                    <span className="text-xs text-[#59413c]">· {h.city}</span>
                    {h.isDemo && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Demo
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0">
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#111c2d] mb-3">
              Team Accounts ({staff.length})
            </h3>
            <div className="divide-y divide-slate-100 text-sm">
              {staff.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-[#111c2d]">{s.nickname}</span>{' '}
                    <span className="text-xs text-[#59413c]">({s.email})</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.role.replace('_', ' ')} · {s.hostelName ?? 'All Properties'}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
