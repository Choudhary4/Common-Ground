import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  referenceId?: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/traveller/notifications');
      setItems(res.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const refresh = () => void load();
    socket.on('notification:new', refresh);
    socket.on('join_request:received', refresh);
    socket.on('join_request:accepted', refresh);
    socket.on('join_request:declined', refresh);
    return () => {
      socket.off('notification:new', refresh);
      socket.off('join_request:received', refresh);
      socket.off('join_request:accepted', refresh);
      socket.off('join_request:declined', refresh);
    };
  }, [load]);

  const markAllRead = async () => {
    await apiRequest('/traveller/notifications/read-all', { method: 'POST' });
    window.dispatchEvent(new Event('notifications:read-all'));
    void load();
  };

  return (
    <TravellerLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-900">Notifications</h1>
          {items.some((i) => !i.readAt) && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#E85D3F] hover:underline"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-amber-200/80 p-8 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">All caught up</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <div
                key={n._id}
                className={`p-4 rounded-2xl border transition ${
                  n.readAt
                    ? 'bg-white border-amber-200/60'
                    : 'bg-[#FFF6F3] border-[#E85D3F]/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {n.referenceId && (
                    <Link
                      to={`/app/activities/${n.referenceId}`}
                      className="text-xs font-semibold text-[#E85D3F] shrink-0 hover:underline"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
