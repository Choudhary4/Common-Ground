import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PaperPlaneTilt,
  ChatCircleDots,
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
import { Avatar } from '../components/Avatar';
import { formatSocialStatus, type SocialStatusValue } from '../components/SocialStatusWidget';
import { type ActivitySummary } from '../components/ActivityCard';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';

interface OptedInTraveller {
  userId: string;
  nickname: string;
  avatar?: string | null;
  interests: string[];
  status: SocialStatusValue | null;
  expiresAt: string | null;
  invited?: boolean;
  isOnline?: boolean;
}

const VIBE_FILTERS = [
  { key: 'ALL', label: 'All', icon: UsersThree },
  { key: 'OPEN_TO_MEETING', label: 'Open to meeting', icon: Sparkle },
  { key: 'UP_FOR_ACTIVITIES', label: 'Up for activities', icon: GameController },
  { key: 'LOOKING_FOR_COMPANY', label: 'Company', icon: Coffee },
  { key: 'JUST_CHILLING', label: 'Chilling', icon: Headphones },
];

const REPORT_REASONS = [
  'Inappropriate behaviour',
  'Spam / Repeated invites',
  'Fake or misleading profile',
  'Harassment or disrespect',
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
  const navigate = useNavigate();
  const [travellers, setTravellers] = useState<OptedInTraveller[]>([]);
  const [myOpenActivities, setMyOpenActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  // Modals
  const [inviteTarget, setInviteTarget] = useState<OptedInTraveller | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const [blockTarget, setBlockTarget] = useState<OptedInTraveller | null>(null);
  const [blocking, setBlocking] = useState(false);

  const [reportTarget, setReportTarget] = useState<OptedInTraveller | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDesc, setReportDesc] = useState('');
  const [reporting, setReporting] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [vibeFilter, setVibeFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    try {
      const [disc, acts] = await Promise.all([
        apiRequest<{ travellers: OptedInTraveller[] }>('/traveller/discover'),
        apiRequest<{ activities: ActivitySummary[] }>('/activities?filter=my'),
      ]);
      setTravellers(disc.travellers);
      setInvitedIds((prev) => {
        const next = new Set(prev);
        for (const t of disc.travellers) {
          if (t.invited) next.add(t.userId);
        }
        return next;
      });
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
    const onPresenceList = (data: { onlineUserIds: string[] }) => {
      const set = new Set(data.onlineUserIds);
      setTravellers((prev) => prev.map((t) => ({ ...t, isOnline: set.has(t.userId) })));
    };
    const onPresenceUpdate = (data: { userId: string; online: boolean }) => {
      setTravellers((prev) =>
        prev.map((t) => (t.userId === data.userId ? { ...t, isOnline: data.online } : t))
      );
    };
    socket.on('social:updated', refresh);
    socket.on('presence:list', onPresenceList);
    socket.on('presence:update', onPresenceUpdate);
    return () => {
      socket.off('social:updated', refresh);
      socket.off('presence:list', onPresenceList);
      socket.off('presence:update', onPresenceUpdate);
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
      setInvitedIds((prev) => new Set(prev).add(inviteTarget.userId));
      setFeedback(`Invited ${inviteTarget.nickname}!`);
      setInviteTarget(null);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Could not send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const cancelInvite = async (target: OptedInTraveller) => {
    setCancellingInviteId(target.userId);
    setFeedback(null);
    try {
      await apiRequest(`/traveller/invite/${target.userId}`, { method: 'DELETE' });
      setInvitedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.userId);
        return next;
      });
      setTravellers((prev) =>
        prev.map((t) => (t.userId === target.userId ? { ...t, invited: false } : t))
      );
      setFeedback(`Cancelled invite to ${target.nickname}.`);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Could not cancel invite');
    } finally {
      setCancellingInviteId(null);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    setStartingChatId(targetUserId);
    try {
      const res = await apiRequest<{ roomId: string }>('/chat/rooms/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      navigate(`/app/chat/${res.roomId}`);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Could not open chat');
    } finally {
      setStartingChatId(null);
    }
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await apiRequest('/traveller/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: blockTarget.userId }),
      });
      setFeedback(`Blocked ${blockTarget.nickname}.`);
      setBlockTarget(null);
      await load();
    } finally {
      setBlocking(false);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setReporting(true);
    try {
      await apiRequest('/traveller/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUserId: reportTarget.userId,
          reason: reportReason,
          description: reportDesc.trim(),
        }),
      });
      setFeedback(`Report submitted for ${reportTarget.nickname}.`);
      setReportTarget(null);
      setReportDesc('');
    } finally {
      setReporting(false);
    }
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
              const isInvited = Boolean(t.invited) || invitedIds.has(t.userId);

              return (
                <div
                  key={t.userId}
                  className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-xs transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar
                          src={t.avatar}
                          name={t.nickname}
                          className="w-11 h-11 rounded-2xl shadow-xs"
                          bgClass={isWarm ? 'bg-[#a93017] text-white' : 'bg-[#14241E] text-white'}
                        />
                        {t.isOnline && (
                          <span
                            title="Online"
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-[#111c2d] text-sm truncate">
                            {t.nickname}
                          </h3>
                          {t.isOnline && (
                            <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                              Online
                            </span>
                          )}
                        </div>
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
                      <button
                        type="button"
                        onClick={() => startDirectChat(t.userId)}
                        disabled={startingChatId === t.userId}
                        title="Chat"
                        className="p-2 rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#14241E] transition active:scale-95 disabled:opacity-60"
                      >
                        {startingChatId === t.userId ? (
                          <CircleNotch className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChatCircleDots weight="duotone" className="w-4 h-4" />
                        )}
                      </button>
                      {myOpenActivities.length > 0 &&
                        (isInvited ? (
                          <button
                            type="button"
                            onClick={() => cancelInvite(t)}
                            disabled={cancellingInviteId === t.userId}
                            title="Tap to cancel invite"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-rose-50 border border-emerald-200 hover:border-rose-200 text-emerald-800 hover:text-rose-700 text-xs font-bold transition active:scale-95 disabled:opacity-60"
                          >
                            {cancellingInviteId === t.userId ? (
                              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle weight="fill" className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>{cancellingInviteId === t.userId ? 'Cancelling...' : 'Invited'}</span>
                            {cancellingInviteId !== t.userId && <X weight="bold" className="w-3 h-3 opacity-60" />}
                          </button>
                        ) : (
                          <button
                            onClick={() => setInviteTarget(t)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-95 text-white text-xs font-bold shadow-xs transition"
                          >
                            <PaperPlaneTilt weight="duotone" className="w-3.5 h-3.5" /> Invite
                          </button>
                        ))}
                      <button
                        onClick={() => {
                          setReportTarget(t);
                          setReportReason(REPORT_REASONS[0]);
                          setReportDesc('');
                        }}
                        className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Report"
                      >
                        <Flag weight="duotone" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setBlockTarget(t)}
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

        {/* Custom Block Modal */}
        {blockTarget && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Prohibit weight="duotone" className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-[#111c2d] text-base">
                    Block {blockTarget.nickname}?
                  </h3>
                </div>
                <button
                  onClick={() => setBlockTarget(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#59413c] leading-relaxed">
                You and <strong>{blockTarget.nickname}</strong> won't see each other in Discover or
                send activity invitations. You can unblock anytime in Settings.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setBlockTarget(null)}
                  disabled={blocking}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBlock}
                  disabled={blocking}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-60"
                >
                  {blocking ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Prohibit weight="bold" className="w-3.5 h-3.5" />
                  )}
                  {blocking ? 'Blocking...' : 'Block Traveller'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Report Modal */}
        {reportTarget && (
          <div className="fixed inset-0 z-50 bg-[#14241E]/50 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={submitReport}
              className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-[#e0bfb8]/35"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Flag weight="duotone" className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-[#111c2d] text-base">
                    Report {reportTarget.nickname}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#111c2d]">Reason</label>
                <div className="flex flex-wrap gap-1.5">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReportReason(r)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                        reportReason === r
                          ? 'bg-[#14241E] text-white'
                          : 'bg-[#f0f3ff] text-[#59413c] hover:bg-[#e7eeff]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1">
                  Details (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="Share any helpful context for the hostel manager..."
                  className="w-full px-3 py-2 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-xs text-[#111c2d]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  disabled={reporting}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#59413c] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-[#a93017] hover:bg-[#cb482c] text-white shadow-xs disabled:opacity-60"
                >
                  {reporting ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Flag weight="duotone" className="w-3.5 h-3.5" />
                  )}
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
