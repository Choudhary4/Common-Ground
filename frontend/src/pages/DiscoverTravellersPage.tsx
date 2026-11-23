import { useCallback, useEffect, useState } from 'react';
import { Send, Flag, Ban, Loader2, Sparkles } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { formatSocialStatus, type SocialStatusValue } from '../components/SocialStatusWidget';
import { type ActivitySummary } from '../components/ActivityCard';
import { apiRequest, ApiError } from '../lib/api';
import { getSocket } from '../lib/socket';

interface OptedInTraveller {
  userId: string;
  nickname: string;
  interests: string[];
  status: SocialStatusValue;
  expiresAt: string;
}

export function DiscoverTravellersPage() {
  const [travellers, setTravellers] = useState<OptedInTraveller[]>([]);
  const [myOpenActivities, setMyOpenActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<OptedInTraveller | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

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

  return (
    <TravellerLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Discover Travellers</h1>
          <p className="text-xs text-slate-500">
            Only travellers who opted in with a social status at your hostel appear here.
          </p>
        </div>

        {feedback && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900">
            {feedback}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : travellers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-200/80 p-8 text-center">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No one else has opted in right now</p>
            <p className="text-xs text-slate-500 mt-1">
              Set your own vibe on the Feed or check out upcoming hostel activities!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {travellers.map((t) => (
              <div
                key={t.userId}
                className="bg-white rounded-2xl border border-amber-200/80 p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{t.nickname}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0EC] text-[#D94E32]">
                      {formatSocialStatus(t.status)}
                    </span>
                  </div>
                  {t.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.interests.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {myOpenActivities.length > 0 && (
                    <button
                      onClick={() => setInviteTarget(t)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E85D3F] text-white text-xs font-semibold hover:bg-[#D94E32]"
                    >
                      <Send className="w-3 h-3" /> Invite
                    </button>
                  )}
                  <button
                    onClick={() => reportUser(t.userId, t.nickname)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Report"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => blockUser(t.userId, t.nickname)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Block"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {inviteTarget && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
              <h3 className="font-bold text-slate-900">Invite {inviteTarget.nickname}</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select your activity
                </label>
                <select
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                >
                  {myOpenActivities.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setInviteTarget(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={sendInvite}
                  disabled={sendingInvite}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#E85D3F] text-white hover:bg-[#D94E32] disabled:opacity-60"
                >
                  {sendingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
