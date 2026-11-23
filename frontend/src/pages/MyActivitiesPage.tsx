import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { ActivityCard, type ActivitySummary } from '../components/ActivityCard';
import { apiRequest } from '../lib/api';

export function MyActivitiesPage() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ activities: ActivitySummary[] }>('/activities?filter=my')
      .then((res) => setActivities(res.activities))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TravellerLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">My Activities</h1>
            <p className="text-xs text-slate-500">Activities you're hosting, joined, or requested</p>
          </div>
          <Link
            to="/app/activities/new"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#E85D3F] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-200/80 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No activities yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Join an activity from the feed or host your own!
            </p>
            <Link
              to="/app"
              className="inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              Browse Feed
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <ActivityCard key={a._id} activity={a} />
            ))}
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
