import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  MapPin,
  UsersThree,
  CheckCircle,
  GlobeHemisphereWest,
  LockSimple,
  Flag,
  PencilSimple,
  XCircle,
  Check,
  X,
  Medal,
  CircleNotch,
  Crown,
  SignOut,
  HandWaving,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';

interface ActivityDetail {
  _id: string;
  title: string;
  description: string;
  category: string;
  creatorType: 'TRAVELLER' | 'HOSTEL_MANAGER';
  creatorNickname: string;
  scheduledAt: string;
  endsAt: string;
  meetingPoint: string;
  maxParticipants: number;
  confirmedCount: number;
  joinMode: 'PUBLIC' | 'APPROVAL';
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';
  isCreator: boolean;
  canManage: boolean;
  isJoined: boolean;
  myJoinRequestStatus: string | null;
}

interface Participant {
  userId: string;
  nickname: string;
  joinedAt: string;
  isHost: boolean;
}

interface PendingRequest {
  id: string;
  requesterId: string;
  nickname: string;
  createdAt: string;
}

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest<{
        activity: ActivityDetail;
        participants: Participant[];
        pendingRequests: PendingRequest[];
      }>(`/activities/${id}`);
      setActivity(res.activity);
      setParticipants(res.participants);
      setPendingRequests(res.pendingRequests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Activity not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const refresh = () => void load();
    socket.on('activity:updated', refresh);
    socket.on('activity:cancelled', refresh);
    socket.on('participant:joined', refresh);
    socket.on('participant:left', refresh);
    socket.on('join_request:received', refresh);
    socket.on('join_request:accepted', refresh);
    return () => {
      socket.off('activity:updated', refresh);
      socket.off('activity:cancelled', refresh);
      socket.off('participant:joined', refresh);
      socket.off('participant:left', refresh);
      socket.off('join_request:received', refresh);
      socket.off('join_request:accepted', refresh);
    };
  }, [load]);

  const handleJoin = async () => {
    if (!id) return;
    setBusyAction('join');
    setError(null);
    try {
      const res = await apiRequest<{ joined: boolean; message: string }>(`/activities/${id}/join`, {
        method: 'POST',
      });
      setBanner(res.joined ? "You're in!" : 'Join request sent to the host!');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join activity');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeave = async () => {
    if (!id) return;
    setBusyAction('leave');
    try {
      await apiRequest(`/activities/${id}/leave`, { method: 'POST' });
      setBanner('You left the activity.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    if (!id || !window.confirm('Cancel this activity for all participants?')) return;
    setBusyAction('cancel');
    try {
      await apiRequest(`/activities/${id}/cancel`, { method: 'POST' });
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setBusyAction('complete');
    try {
      await apiRequest(`/activities/${id}/complete`, { method: 'POST' });
      setBanner('Activity marked as completed!');
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const resolveRequest = async (reqId: string, decision: 'ACCEPT' | 'DECLINE') => {
    if (!id) return;
    setBusyAction(`${decision}:${reqId}`);
    try {
      await apiRequest(`/activities/${id}/requests/${reqId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve request');
    } finally {
      setBusyAction(null);
    }
  };

  const handleReport = async () => {
    if (!id) return;
    const reason = window.prompt('Why are you reporting this activity?');
    if (!reason || reason.trim().length < 3) return;
    await apiRequest('/traveller/reports', {
      method: 'POST',
      body: JSON.stringify({ activityId: id, reason: reason.trim() }),
    });
    setBanner('Report submitted to hostel manager.');
  };

  const isOfficial = activity?.creatorType === 'HOSTEL_MANAGER';
  const spotsLeft = activity ? Math.max(0, activity.maxParticipants - activity.confirmedCount) : 0;
  const pct = activity
    ? Math.min(100, Math.round((activity.confirmedCount / Math.max(1, activity.maxParticipants)) * 100))
    : 0;

  return (
    <TravellerLayout>
      <div className="space-y-4">
        <button
          onClick={() => {
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (idx > 0) navigate(-1);
            else navigate('/app', { replace: true });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e0bfb8]/40 text-xs font-bold text-[#59413c] hover:text-[#111c2d] shadow-2xs transition"
        >
          <ArrowLeft weight="bold" className="w-3.5 h-3.5" /> Back
        </button>

        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <CircleNotch className="w-6 h-6 animate-spin" />
          </div>
        ) : !activity ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm font-semibold text-rose-600 border border-rose-200">
            {error}
          </div>
        ) : (
          <>
            {banner && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold flex items-start gap-2.5 shadow-2xs">
                <CheckCircle weight="fill" className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p>{banner}</p>
                  {activity.isJoined && (
                    <p className="text-xs font-medium text-emerald-700 mt-0.5">
                      Meet everyone at {activity.meetingPoint} at{' '}
                      {new Date(activity.scheduledAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      .
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Main Activity Card */}
            <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 shadow-sm overflow-hidden relative">
              <div
                className={`h-1.5 bg-gradient-to-r ${
                  isOfficial
                    ? 'from-amber-500 via-orange-500 to-[#a93017]'
                    : 'from-emerald-500 via-teal-500 to-[#00685d]'
                }`}
              />

              <div className="p-5 space-y-4">
                {/* Badges & Report */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isOfficial ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                        <Medal weight="duotone" className="w-3.5 h-3.5" /> Official Hostel Event
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#6fd8c8]/30 text-[#00685d]">
                        Traveller Hosted
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                      {activity.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        activity.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activity.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {activity.status}
                    </span>
                  </div>

                  {!activity.isCreator && (
                    <button
                      onClick={handleReport}
                      className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Report activity"
                    >
                      <Flag weight="duotone" className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Title & Host */}
                <div>
                  <h1 className="text-[24px] font-extrabold text-[#111c2d] leading-tight">
                    {activity.title}
                  </h1>
                  <p className="text-xs text-[#59413c] mt-1">
                    Hosted by{' '}
                    <span className="font-bold text-[#111c2d]">{activity.creatorNickname}</span>
                  </p>
                </div>

                <p className="text-sm text-[#59413c] leading-relaxed">{activity.description}</p>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#f0f3ff] border border-[#e0bfb8]/25 text-xs">
                  <div className="flex items-start gap-2">
                    <CalendarBlank weight="duotone" className="w-4 h-4 text-[#a93017] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">When</p>
                      <p className="font-bold text-[#111c2d]">
                        {new Date(activity.scheduledAt).toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin weight="fill" className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Where</p>
                      <p className="font-bold text-[#111c2d]">{activity.meetingPoint}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <UsersThree weight="duotone" className="w-4 h-4 text-[#a93017] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Spots</p>
                      <p className="font-bold text-[#111c2d]">
                        {activity.confirmedCount} / {activity.maxParticipants} confirmed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {activity.joinMode === 'PUBLIC' ? (
                      <GlobeHemisphereWest weight="duotone" className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <LockSimple weight="duotone" className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Entry</p>
                      <p className="font-bold text-[#111c2d]">
                        {activity.joinMode === 'PUBLIC' ? 'Instant Join' : 'Host Approval'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-semibold text-[#59413c]">
                    <span>Circle capacity</span>
                    <span>{spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} remaining</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#e7eeff] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOfficial ? 'bg-gradient-to-r from-amber-500 to-[#a93017]' : 'bg-[#00685d]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons — Clean Primary + Secondary Grid */}
                <div className="space-y-2.5 pt-1">
                  {!activity.isJoined &&
                    activity.status === 'OPEN' &&
                    activity.myJoinRequestStatus !== 'PENDING' && (
                      <button
                        onClick={handleJoin}
                        disabled={busyAction !== null}
                        className="w-full h-12 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
                      >
                        {busyAction === 'join' ? (
                          <CircleNotch className="w-4 h-4 animate-spin" />
                        ) : activity.joinMode === 'APPROVAL' ? (
                          <HandWaving weight="duotone" className="w-4 h-4" />
                        ) : null}
                        <span>
                          {busyAction === 'join'
                            ? activity.joinMode === 'PUBLIC'
                              ? 'Joining...'
                              : 'Sending Request...'
                            : activity.joinMode === 'PUBLIC'
                              ? 'Quick RSVP · Join Circle'
                              : 'Request to Join'}
                        </span>
                        {busyAction !== 'join' && activity.joinMode === 'PUBLIC' && (
                          <ArrowRight weight="bold" className="w-4 h-4" />
                        )}
                      </button>
                    )}

                  {activity.myJoinRequestStatus === 'PENDING' && !activity.isJoined && (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                      <span>Pending host approval...</span>
                      <button
                        onClick={handleLeave}
                        disabled={busyAction !== null}
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline disabled:opacity-60"
                      >
                        {busyAction === 'leave' && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                        {busyAction === 'leave' ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    </div>
                  )}

                  {activity.canManage && ['OPEN', 'FULL'].includes(activity.status) && (
                    <button
                      onClick={handleComplete}
                      disabled={busyAction !== null}
                      className="w-full h-11 rounded-full bg-[#14241E] hover:bg-emerald-950 active:scale-[0.98] text-emerald-300 font-bold text-xs inline-flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-60"
                    >
                      {busyAction === 'complete' ? (
                        <CircleNotch className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle weight="fill" className="w-4 h-4 text-emerald-400" />
                      )}
                      {busyAction === 'complete' ? 'Completing...' : 'Mark Activity Completed'}
                    </button>
                  )}

                  {['OPEN', 'FULL'].includes(activity.status) && (activity.isJoined || activity.canManage) && (
                    <div className="grid grid-cols-3 gap-2">
                      {activity.canManage && (
                        <Link
                          to={`/app/activities/${activity._id}/edit`}
                          className="h-10 rounded-xl bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                        >
                          <PencilSimple weight="duotone" className="w-4 h-4" /> Edit
                        </Link>
                      )}
                      {activity.isJoined && (
                        <button
                          onClick={handleLeave}
                          disabled={busyAction !== null}
                          className={`h-10 rounded-xl border border-[#e0bfb8]/50 bg-white hover:bg-slate-50 text-[#59413c] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-60 ${
                            !activity.canManage ? 'col-span-3' : ''
                          }`}
                        >
                          {busyAction === 'leave' ? (
                            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <SignOut weight="duotone" className="w-4 h-4" />
                          )}
                          {busyAction === 'leave' ? 'Leaving...' : 'Leave'}
                        </button>
                      )}
                      {activity.canManage && (
                        <button
                          onClick={handleCancel}
                          disabled={busyAction !== null}
                          className="h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-60"
                        >
                          {busyAction === 'cancel' ? (
                            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle weight="duotone" className="w-4 h-4" />
                          )}
                          {busyAction === 'cancel' ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pending Join Requests */}
            {activity.canManage && pendingRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-5 space-y-3 shadow-xs">
                <h2 className="text-sm font-extrabold text-[#111c2d]">
                  Pending Join Requests ({pendingRequests.length})
                </h2>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#f0f3ff]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-[#14241E] text-emerald-300 font-bold text-xs flex items-center justify-center">
                          {req.nickname.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-sm font-bold text-[#111c2d]">{req.nickname}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => resolveRequest(req.id, 'ACCEPT')}
                          disabled={busyAction !== null}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60"
                        >
                          {busyAction === `ACCEPT:${req.id}` ? (
                            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check weight="bold" className="w-3.5 h-3.5" />
                          )}
                          {busyAction === `ACCEPT:${req.id}` ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => resolveRequest(req.id, 'DECLINE')}
                          disabled={busyAction !== null}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-bold disabled:opacity-60"
                        >
                          {busyAction === `DECLINE:${req.id}` ? (
                            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X weight="bold" className="w-3.5 h-3.5" />
                          )}
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Participants */}
            <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-5 space-y-3 shadow-xs">
              <h2 className="text-sm font-extrabold text-[#111c2d]">
                Confirmed Participants ({participants.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => {
                  const initials = p.nickname
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <div
                      key={p.userId}
                      className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-[#f0f3ff] border border-[#e0bfb8]/30 text-xs font-bold text-[#111c2d]"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#14241E] text-emerald-300 text-[10px] font-bold flex items-center justify-center">
                        {initials}
                      </span>
                      <span>{p.nickname}</span>
                      {p.isHost && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#14241E] text-amber-300 text-[9px] font-extrabold uppercase">
                          <Crown weight="fill" className="w-2.5 h-2.5" /> Host
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </TravellerLayout>
  );
}
