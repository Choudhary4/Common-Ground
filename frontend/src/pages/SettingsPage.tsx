import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, UserX, Loader2 } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { logout, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<Array<{ _id: string; nickname: string }>>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await apiRequest<{
      nickname: string;
      interests: string[];
      blockedUsers: Array<{ _id: string; nickname: string }>;
    }>('/traveller/settings');
    setNickname(res.nickname);
    setInterestsText(res.interests.join(', '));
    setBlockedUsers(res.blockedUsers);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const interests = interestsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      await apiRequest('/traveller/settings', {
        method: 'PATCH',
        body: JSON.stringify({ nickname: nickname.trim(), interests }),
      });
      await refreshAuth();
      setSavedMsg('Preferences saved!');
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (id: string) => {
    await apiRequest(`/traveller/block/${id}`, { method: 'DELETE' });
    void load();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <TravellerLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>

        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-4"
        >
          {savedMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
              {savedMsg}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nickname</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Interests (comma separated, up to 5)
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="Chai, Photography, Board Games"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold hover:bg-[#D94E32] disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Blocked Travellers</h2>
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-slate-500">You haven't blocked anyone.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((u) => (
                <div key={u._id} className="flex items-center justify-between text-sm">
                  <span>{u.nickname}</span>
                  <button
                    onClick={() => unblock(u._id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <UserX className="w-3.5 h-3.5" /> Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-rose-100"
        >
          <LogOut className="w-4 h-4" /> Log out &amp; End Session
        </button>
      </div>
    </TravellerLayout>
  );
}
