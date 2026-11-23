import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Flag,
  Edit3,
  XCircle,
  Check,
  X,
  Award,
  Loader2,
} from 'lucide-react';
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
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
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
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/activities/${id}/leave`, { method: 'POST' });
      setBanner('You left the activity.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !window.confirm('Cancel this activity for all participants?')) return;
    setBusy(true);
    try {
      await apiRequest(`/activities/${id}/cancel`, { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/activities/${id}/complete`, { method: 'POST' });
      setBanner('Activity marked as completed!');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolveRequest = async (reqId: string, decision: 'ACCEPT' | 'DECLINE') => {
    if (!id) return;
    setBusy(true);
    try {
      await apiRequest(`/activities/${id}/requests/${reqId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve request');
    } finally {
      setBusy(false);
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

  return (
    <TravellerLayout>
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !activity ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-rose-600">{error}</div>
        ) : (
          <>
            {banner && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p>{banner}</p>
                  {activity.isJoined && (
                    <p className="text-xs font-normal text-emerald-700 mt-0.5">
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
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {error}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {activity.creatorType === 'HOSTEL_MANAGER' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF0EC] text-[#D94E32]">
                      <Award className="w-3.5 h-3.5" /> Official Hostel Activity
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900">
                    {activity.category}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {activity.status}
                  </span>
                </div>

                {!activity.isCreator && (
                  <button
                    onClick={handleReport}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Report activity"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">{activity.title}</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Hosted by <span className="font-semibold text-slate-800">{activity.creatorNickname}</span>
                </p>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{activity.description}</p>

              <div className="grid sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAF7F2] text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#E85D3F]" />
                  <span>
                    {new Date(activity.scheduledAt).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E85D3F]" />
                  <span>{activity.meetingPoint}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E85D3F]" />
                  <span>
                    {activity.confirmedCount} / {activity.maxParticipants} confirmed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E85D3F]" />
                  <span>
                    {activity.joinMode === 'PUBLIC' ? 'Instant Join' : 'Host Approval Required'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                {!activity.isJoined &&
                  activity.status === 'OPEN' &&
                  activity.myJoinRequestStatus !== 'PENDING' && (
                    <button
                      onClick={handleJoin}
                      disabled={busy}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#E85D3F] hover:bg-[#D94E32] text-white font-semibold text-sm transition"
                    >
                      {activity.joinMode === 'PUBLIC' ? 'Join Activity' : 'Request to Join'}
                    </button>
                  )}

                {activity.myJoinRequestStatus === 'PENDING' && !activity.isJoined && (
                  <div className="flex items-center gap-2 w-full justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                    <span>Pending host approval...</span>
                    <button
                      onClick={handleLeave}
                      disabled={busy}
                      className="text-rose-600 hover:underline"
                    >
                      Withdraw
                    </button>
                  </div>
                )}

                {activity.isJoined && ['OPEN', 'FULL'].includes(activity.status) && (
                  <button
                    onClick={handleLeave}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    Leave Activity
                  </button>
                )}

                {activity.canManage && ['OPEN', 'FULL'].includes(activity.status) && (
                  <>
                    <Link
                      to={`/app/activities/${activity._id}/edit`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </Link>
                    <button
                      onClick={handleComplete}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {activity.canManage && pendingRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Pending Join Requests ({pendingRequests.length})
                </h2>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2]"
                    >
                      <span className="text-sm font-semibold text-slate-800">{req.nickname}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveRequest(req.id, 'ACCEPT')}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => resolveRequest(req.id, 'DECLINE')}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-amber-200/80 p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Confirmed Participants ({participants.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <span
                    key={p.userId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F2] border border-amber-200/60 text-xs font-medium text-slate-800"
                  >
                    {p.nickname}
                    {p.isHost && (
                      <span className="text-[10px] font-bold text-[#E85D3F]">HOST</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </TravellerLayout>
  );
}
