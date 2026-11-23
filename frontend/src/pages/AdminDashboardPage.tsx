import React, { useCallback, useEffect, useState } from 'react';
import { Building2, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
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
      setMsg('Hostel created!');
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
    <StaffLayout title="Central Admin" subtitle="Platform Properties, Managers & Staff">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">QR Scans (Real)</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.realMetrics.qrScans ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Travellers Joined</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {overview?.realMetrics.travellersOnboarded ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Activities Created</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.realMetrics.activitiesCreated ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4">
            <p className="text-xs text-slate-500">Activity Joins</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {overview?.realMetrics.activitiesJoined ?? '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500">Active Hostels</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {overview?.activeHostels ?? '—'}
            </p>
          </div>
        </div>

        {overview?.hostelBreakdown && overview.hostelBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200/80 p-5 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Hostel-wise Real Adoption (Excludes Demo Data)
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Hostel</th>
                  <th className="py-2 px-3 font-semibold">QR Scans</th>
                  <th className="py-2 px-3 font-semibold">Travellers</th>
                  <th className="py-2 px-3 font-semibold">Activities</th>
                  <th className="py-2 px-3 font-semibold">Joins</th>
                  <th className="py-2 pl-3 font-semibold">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.hostelBreakdown.map((row) => (
                  <tr key={row.hostelId}>
                    <td className="py-2.5 pr-4 font-semibold text-slate-900">
                      {row.name} <span className="font-normal text-slate-500">· {row.city}</span>
                    </td>
                    <td className="py-2.5 px-3">{row.qrScans}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700">
                      {row.travellersOnboarded}
                    </td>
                    <td className="py-2.5 px-3">{row.activitiesCreated}</td>
                    <td className="py-2.5 px-3">{row.activitiesJoined}</td>
                    <td className="py-2.5 pl-3">{row.activitiesCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {msg && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
            {msg}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <form
            onSubmit={createHostel}
            className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#E85D3F]" />
              <h2 className="text-base font-bold text-slate-900">Add Hostel Property</h2>
            </div>
            <input
              required
              value={hName}
              onChange={(e) => setHName(e.target.value)}
              placeholder="goSTOPS Manali"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <input
              required
              value={hCity}
              onChange={(e) => setHCity(e.target.value)}
              placeholder="City"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <input
              required
              value={hAddr}
              onChange={(e) => setHAddr(e.target.value)}
              placeholder="Full address"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <button
              type="submit"
              disabled={creatingHostel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-60"
            >
              {creatingHostel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {creatingHostel ? 'Creating Hostel...' : 'Create Hostel'}
            </button>
          </form>

          <form
            onSubmit={createStaff}
            className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#E85D3F]" />
              <h2 className="text-base font-bold text-slate-900">Add Hostel Manager</h2>
            </div>
            <input
              required
              value={sName}
              onChange={(e) => setSName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="email"
              required
              value={sEmail}
              onChange={(e) => setSEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={sPass}
                onChange={(e) => setSPass(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <select
              value={sHostelId}
              onChange={(e) => setSHostelId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold disabled:opacity-60"
            >
              {creatingManager && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {creatingManager ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Hostels ({hostels.length})</h3>
          <div className="divide-y divide-slate-100 text-sm">
            {hostels.map((h) => (
              <div key={h._id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900">{h.name}</span>{' '}
                  <span className="text-xs text-slate-500">· {h.city}</span>
                  {h.isDemo && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                      Demo
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-emerald-700">{h.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Team Accounts ({staff.length})</h3>
          <div className="divide-y divide-slate-100 text-sm">
            {staff.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900">{s.nickname}</span>{' '}
                  <span className="text-xs text-slate-500">({s.email})</span>
                  <p className="text-xs text-slate-500">
                    {s.role} · {s.hostelName}
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-700">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
