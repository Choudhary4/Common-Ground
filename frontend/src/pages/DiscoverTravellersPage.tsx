import { useCallback, useEffect, useState } from 'react';
import {
  PaperPlaneTilt,
  Flag,
  Prohibit,
  CircleNotch,
  Sparkle,
  UsersThree,
  GameController,
  Coffee,
  Headphones,
  X,
  CheckCircle,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { formatSocialStatus, type SocialStatusValue } from '../components/SocialStatusWidget';
import { type ActivitySummary } from '../components/ActivityCard';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';

interface OptedInTraveller {
  userId: string;
  nickname: string;
  interests: string[];
  status: SocialStatusValue | null;
  expiresAt: string | null;
}

const VIBE_FILTERS = [
  { key: 'ALL', label: 'All', icon: UsersThree },
  { key: 'OPEN_TO_MEETING', label: 'Open to meeting', icon: Sparkle },
  { key: 'UP_FOR_ACTIVITIES', label: 'Up for activities', icon: GameController },
  { key: 'LOOKING_FOR_COMPANY', label: 'Company', icon: Coffee },
  { key: 'JUST_CHILLING', label: 'Chilling', icon: Headphones },
];

function getVibeBadgeStyle(status: SocialStatusValue | null) {
  switch (status) {
    case 'OPEN_TO_MEETING':
      return { bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-800', icon: Sparkle };
    case 'UP_FOR_ACTIVITIES':
      return { bg: 'bg-[#ffdad3]/60 border-[#a93017]/20', text: 'text-[#a93017]', icon: GameController };
    case 'LOOKING_FOR_COMPANY':
      return { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', icon: Coffee };
    case 'JUST_CHILLING':
      return { bg: 'bg-[#f0f3ff] border-[#e0bfb8]/30', text: 'text-[#59413c]', icon: Headphones };
    default:
      return { bg: 'bg-slate-100 border-slate-200/60', text: 'text-slate-500', icon: null };
  }
}

export function DiscoverTravellersPage() {
  const [travellers, setTravellers] = useState<OptedInTraveller[]>([]);
  const [myOpenActivities, setMyOpenActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<OptedInTraveller | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [vibeFilter, setVibeFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    try {
      const [disc, acts] = await Promise.all([
        apiRequest<{ travellers: OptedInTraveller[] }>('/traveller/discover'),
        apiRequest<{ activities: ActivitySummary[] }>('/activities?filter=my'),
      ]);
      setTravellers(disc.travellers);
      const openOwned = acts.activities.filter((a) => a.isCreator && a.status === 'OPEN');
      setMyOpenActivities(openOwned);
      if (openOwned.length > 0 && !selectedActivityId) {
        setSelectedActivityId(openOwned[0]._id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedActivityId]);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const refresh = () => void load();
    socket.on('social:updated', refresh);
    return () => {
      socket.off('social:updated', refresh);
    };
  }, [load]);

  const sendInvite = async () => {
    if (!inviteTarget || !selectedActivityId) return;
    setFeedback(null);
    setSendingInvite(true);
    try {
      await apiRequest('/traveller/invite', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: inviteTarget.userId,
          activityId: selectedActivityId,
        }),
      });
      setFeedback(`Invited ${inviteTarget.nickname}!`);
      setInviteTarget(null);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Could not send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const blockUser = async (targetUserId: string, nickname: string) => {
    if (!window.confirm(`Block ${nickname}? You won't see each other in discovery.`)) return;
    await apiRequest('/traveller/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
    void load();
  };

  const reportUser = async (targetUserId: string, nickname: string) => {
    const reason = window.prompt(`Why are you reporting ${nickname}?`);
    if (!reason || reason.trim().length < 3) return;
    await apiRequest('/traveller/reports', {
      method: 'POST',
      body: JSON.stringify({ reportedUserId: targetUserId, reason: reason.trim() }),
    });
    setFeedback('Report submitted to hostel manager.');
  };

  const filteredTravellers = travellers.filter(
    (t) => vibeFilter === 'ALL' || t.status === vibeFilter
  );

  return (
    <TravellerLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#111c2d] tracking-tight">
              Discover Travellers
            </h1>
            <p className="text-xs text-[#59413c]">People staying at your hostel right now</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#14241E] text-emerald-300 text-[11px] font-bold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {travellers.length} live
          </span>
        </div>

        {/* Vibe Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
          {VIBE_FILTERS.map((f) => {
            const active = vibeFilter === f.key;
            const FilterIcon = f.icon;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setVibeFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition ${
                  active
                    ? 'bg-[#14241E] text-white shadow-sm'
                    : 'bg-white text-[#59413c] border border-[#e0bfb8]/35 hover:bg-[#f0f3ff] shadow-2xs'
                }`}
              >
                <FilterIcon
                  weight="duotone"
                  className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-[#a93017]'}`}
                />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle weight="fill" className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Travellers List */}
        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <CircleNotch className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredTravellers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center mx-auto mb-3">
              <UsersThree weight="duotone" className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#111c2d]">
              {vibeFilter === 'ALL'
                ? 'No other travellers active right now'
                : 'No travellers with this vibe yet'}
            </p>
            <p className="text-xs text-[#59413c] mt-1">
              Set your own vibe on the Radar or host a quick hostel plan!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTravellers.map((t, idx) => {
              const initials = t.nickname
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const badge = getVibeBadgeStyle(t.status);
              const BadgeIcon = badge.icon;
              const isWarm = idx % 2 === 1;

              return (
                <div
                  key={t.userId}
                  className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-xs transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-11 h-11 rounded-2xl font-extrabold text-xs flex items-center justify-center text-white shadow-xs ${
                            isWarm ? 'bg-[#a93017]' : 'bg-[#14241E]'
                          }`}
                        >
                          {initials}
                        </div>
                        {t.status && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-extrabold text-[#111c2d] text-sm truncate">
                          {t.nickname}
                        </h3>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text}`}
                        >
                          {BadgeIcon && <BadgeIcon weight="duotone" className="w-3.5 h-3.5" />}
                          {t.status ? formatSocialStatus(t.status) : 'No vibe set'}
                        </span>

                        {t.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.interests.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-[#f0f3ff] text-[#59413c] text-[10px] font-semibold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {myOpenActivities.length > 0 && (
                        <button
                          onClick={() => setInviteTarget(t)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-95 text-white text-xs font-bold shadow-xs transition"
                        >
                          <PaperPlaneTilt weight="duotone" className="w-3.5 h-3.5" /> Invite
                        </button>
                      )}
                      <button
                        onClick={() => reportUser(t.userId, t.nickname)}
                        className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Report"
                      >
                        <Flag weight="duotone" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => blockUser(t.userId, t.nickname)}
                        className="p-2 rounded-full text-slate-400 hover:text-[#111c2d] hover:bg-slate-100 transition"
                        title="Block"
                      >
                        <Prohibit weight="duotone" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Invite Modal */}
        {inviteTarget && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#111c2d] text-base">
                  Invite {inviteTarget.nickname}
                </h3>
                <button
                  onClick={() => setInviteTarget(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Select your open activity
                </label>
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d]"
                >
                  {myOpenActivities.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setInviteTarget(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={sendInvite}
                  disabled={sendingInvite}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-[#a93017] hover:bg-[#cb482c] text-white shadow-xs disabled:opacity-60"
                >
                  {sendingInvite ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PaperPlaneTilt weight="duotone" className="w-3.5 h-3.5" />
                  )}
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
