import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Loader2 } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { SocialStatusWidget, type SocialStatusValue } from '../components/SocialStatusWidget';
import { ActivityCard, type ActivitySummary } from '../components/ActivityCard';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

const FEED_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'starting_soon', label: 'Starting soon' },
  { key: 'upcoming', label: 'Upcoming' },
];

const CATEGORY_FILTERS = [
  { key: 'ALL', label: 'All vibes' },
  { key: 'GAMES', label: 'Games' },
  { key: 'SOCIAL', label: 'Social' },
  { key: 'EXPLORATION', label: 'Exploration' },
  { key: 'FOOD', label: 'Food' },
];

export function TravellerDashboard() {
  const { user } = useAuth();
  const [statusDoc, setStatusDoc] = useState<{ status: SocialStatusValue; expiresAt: string } | null>(
    null
  );
  const [openCount, setOpenCount] = useState(0);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, discoverRes, actRes] = await Promise.all([
        apiRequest<{ status: { status: SocialStatusValue; expiresAt: string } | null }>(
          '/traveller/status'
        ),
        apiRequest<{ openCount: number }>('/traveller/discover'),
        apiRequest<{ activities: ActivitySummary[] }>(
          `/activities?filter=${filter}&category=${category}`
        ),
      ]);
      setStatusDoc(statusRes.status);
      setOpenCount(discoverRes.openCount);
      setActivities(actRes.activities);
    } finally {
      setLoading(false);
    }
  }, [filter, category]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => void loadData();
    socket.on('activity:created', refresh);
    socket.on('activity:updated', refresh);
    socket.on('activity:cancelled', refresh);
    socket.on('activity:full', refresh);
    socket.on('participant:joined', refresh);
    socket.on('participant:left', refresh);
    socket.on('social:updated', refresh);

    return () => {
      socket.off('activity:created', refresh);
      socket.off('activity:updated', refresh);
      socket.off('activity:cancelled', refresh);
      socket.off('activity:full', refresh);
      socket.off('participant:joined', refresh);
      socket.off('participant:left', refresh);
      socket.off('social:updated', refresh);
    };
  }, [loadData]);

  return (
    <TravellerLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Hey {user?.nickname}!
            </h1>
            <p className="text-xs text-slate-500">See who's around or join an activity</p>
          </div>
          <Link
            to="/app/activities/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E85D3F] hover:bg-[#D94E32] text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Create Activity
          </Link>
        </div>

        <SocialStatusWidget
          currentStatus={statusDoc?.status ?? null}
          expiresAt={statusDoc?.expiresAt ?? null}
          openCount={openCount}
          onUpdated={loadData}
        />

        <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#E85D3F]" />
            <p className="text-xs sm:text-sm text-slate-700">
              <span className="font-bold text-slate-900">{openCount}</span> opted-in{' '}
              {openCount === 1 ? 'traveller' : 'travellers'} at {user?.hostelName}
            </p>
          </div>
          <Link to="/app/discover" className="text-xs font-bold text-[#E85D3F] hover:underline">
            Discover →
          </Link>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Activities at your hostel</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  filter === f.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            {CATEGORY_FILTERS.filter((c) => c.key !== 'ALL').map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(category === c.key ? 'ALL' : c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  category === c.key
                    ? 'bg-[#E85D3F] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-10 flex justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200/80 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800 mb-1">No matching activities yet</p>
              <p className="text-xs text-slate-500 mb-4">
                Start something simple—like chai on the rooftop or a quick card game.
              </p>
              <Link
                to="/app/activities/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Host an activity
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <ActivityCard key={a._id} activity={a} onJoined={loadData} />
              ))}
            </div>
          )}
        </section>
      </div>
    </TravellerLayout>
  );
}
