import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SignOut,
  UserMinus,
  CircleNotch,
  BellRinging,
  MapPin,
  CheckCircle,
  Sparkle,
  Prohibit,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { Avatar, PRESET_AVATARS } from '../components/Avatar';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
  isPushSupported,
} from '../lib/push';

const SUGGESTED_INTERESTS = [
  'Chai',
  'Board Games',
  'Street Food',
  'Photography',
  'City Walks',
  'Music',
];

export function SettingsPage() {
  const { user, logout, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [interestsText, setInterestsText] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<Array<{ _id: string; nickname: string }>>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = async () => {
    const res = await apiRequest<{
      nickname: string;
      avatar: string | null;
      interests: string[];
      blockedUsers: Array<{ _id: string; nickname: string }>;
    }>('/traveller/settings');
    setNickname(res.nickname);
    setAvatar(res.avatar ?? null);
    setInterestsText(res.interests.join(', '));
    setBlockedUsers(res.blockedUsers);
  };

  useEffect(() => {
    void load();
    void getCurrentPushSubscription().then((sub) => setPushEnabled(Boolean(sub)));
  }, []);

  const currentInterests = interestsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleSuggestedInterest = (tag: string) => {
    const exists = currentInterests.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setInterestsText(
        currentInterests.filter((t) => t.toLowerCase() !== tag.toLowerCase()).join(', ')
      );
    } else if (currentInterests.length < 5) {
      setInterestsText([...currentInterests, tag].join(', '));
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
        setPushMsg('Mobile push notifications disabled.');
      } else {
        const ok = await enablePushNotifications();
        setPushEnabled(ok);
        setPushMsg(
          ok
            ? 'Mobile push notifications enabled!'
            : 'Permission denied or not supported on this browser.'
        );
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const interests = currentInterests.slice(0, 5);
      await apiRequest('/traveller/settings', {
        method: 'PATCH',
        body: JSON.stringify({ nickname: nickname.trim(), avatar, interests }),
      });
      await refreshAuth();
      setSavedMsg('Profile preferences saved!');
    } finally {
      setSaving(false);
    }
  };

  const sendTestPush = async () => {
    setTestingPush(true);
    setPushMsg(null);
    try {
      await enablePushNotifications().catch(() => {});
      const res = await apiRequest<{ configured: boolean; subscriptions: number; sent: number }>(
        '/traveller/push/test',
        { method: 'POST' }
      );
      if (!res.configured) {
        setPushMsg('Push keys not configured on server yet.');
      } else if (res.sent > 0) {
        setPushMsg('Test alert sent! Check your device notification bar.');
      } else {
        setPushMsg('No active push subscription found on this device. Try Disable → Enable.');
      }
    } finally {
      setTestingPush(false);
    }
  };

  const unblock = async (id: string) => {
    setUnblockingId(id);
    try {
      await apiRequest(`/traveller/block/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setUnblockingId(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = (nickname || user?.nickname || 'CG')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TravellerLayout>
      <div className="space-y-4">
        {/* Profile Header Card */}
        <div className="rounded-2xl bg-[#14241E] text-white p-5 shadow-sm border border-emerald-500/20 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-300 p-0.5 shrink-0">
            <Avatar
              src={avatar}
              name={nickname || user?.nickname || initials}
              className="w-full h-full rounded-[14px]"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold truncate">{nickname || user?.nickname}</h1>
            {user?.hostelName && (
              <p className="text-xs text-emerald-200/80 flex items-center gap-1 mt-0.5">
                <MapPin weight="fill" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{user.hostelName}</span>
              </p>
            )}
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-200 text-[10px] font-bold">
              Active 72h Traveller Session
            </span>
          </div>
        </div>

        {/* Profile Form */}
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Sparkle weight="duotone" className="w-4 h-4 text-[#a93017]" />
            <h2 className="text-sm font-extrabold text-[#111c2d]">Traveller Profile</h2>
          </div>

          {savedMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600" />
              {savedMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#111c2d] mb-2">Choose Your Avatar</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_AVATARS.map((url) => {
                const selected = avatar === url;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatar(selected ? null : url)}
                    className={`rounded-2xl p-0.5 transition active:scale-95 ${
                      selected
                        ? 'ring-2 ring-[#a93017] bg-[#ffdad3]/40'
                        : 'hover:ring-2 hover:ring-slate-300'
                    }`}
                  >
                    <img src={url} alt="Avatar option" className="w-full aspect-square rounded-xl" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Nickname</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
              Interests (up to 5)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {SUGGESTED_INTERESTS.map((tag) => {
                const selected = currentInterests.some(
                  (t) => t.toLowerCase() === tag.toLowerCase()
                );
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSuggestedInterest(tag)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                      selected
                        ? 'bg-[#14241E] text-white'
                        : 'bg-[#f0f3ff] text-[#59413c] hover:bg-[#e7eeff]'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {tag}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="Chai, Photography, Board Games"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-60"
          >
            {saving && <CircleNotch className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Mobile Push Notifications */}
        <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  pushEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f0f3ff] text-[#a93017]'
                }`}
              >
                <BellRinging weight="duotone" className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111c2d]">Mobile Push Alerts</h2>
                <p className="text-xs text-[#59413c]">
                  Invites, join requests &amp; activity updates
                </p>
              </div>
            </div>
            {isPushSupported() ? (
              <button
                type="button"
                onClick={togglePush}
                disabled={pushBusy}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition active:scale-95 disabled:opacity-60 shrink-0 ${
                  pushEnabled
                    ? 'bg-[#f0f3ff] text-[#59413c] hover:bg-slate-200'
                    : 'bg-[#14241E] text-emerald-300 hover:bg-emerald-950'
                }`}
              >
                {pushBusy ? '...' : pushEnabled ? 'Disable' : 'Enable'}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">Unsupported</span>
            )}
          </div>
          {pushEnabled && (
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={sendTestPush}
                disabled={testingPush}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-[11px] font-bold disabled:opacity-60"
              >
                {testingPush && <CircleNotch className="w-3 h-3 animate-spin" />}
                {testingPush ? 'Sending...' : 'Send Test Notification'}
              </button>
            </div>
          )}
          {pushMsg && <p className="text-xs font-semibold text-emerald-700">{pushMsg}</p>}
        </div>

        {/* Blocked Travellers */}
        <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Prohibit weight="duotone" className="w-4 h-4 text-[#59413c]" />
            <h2 className="text-sm font-bold text-[#111c2d]">Blocked Travellers</h2>
          </div>
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-[#59413c]">You haven't blocked anyone.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#f0f3ff] text-xs"
                >
                  <span className="font-bold text-[#111c2d]">{u.nickname}</span>
                  <button
                    onClick={() => unblock(u._id)}
                    disabled={unblockingId === u._id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-[#59413c] font-bold hover:text-[#111c2d] disabled:opacity-60"
                  >
                    {unblockingId === u._id ? (
                      <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserMinus weight="duotone" className="w-3.5 h-3.5" />
                    )}
                    {unblockingId === u._id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full h-11 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
        >
          {loggingOut ? (
            <CircleNotch className="w-4 h-4 animate-spin" />
          ) : (
            <SignOut weight="duotone" className="w-4 h-4" />
          )}
          {loggingOut ? 'Ending Session...' : 'Log out & End Session'}
        </button>
      </div>
    </TravellerLayout>
  );
}
