import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRinging,
  BellSlash,
  Checks,
  CircleNotch,
  CheckCircle,
  UserPlus,
  XCircle,
  PaperPlaneTilt,
  Crown,
  CaretRight,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';

interface NotificationItem {
  _id: string;
  type?: string;
  title: string;
  message: string;
  referenceId?: string | null;
  readAt: string | null;
  createdAt: string;
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getNotifStyle(type?: string) {
  switch (type) {
    case 'ACTIVITY_CANCELLED':
      return { icon: XCircle, bg: 'bg-rose-50', color: 'text-rose-600' };
    case 'JOIN_REQUEST_RECEIVED':
      return { icon: UserPlus, bg: 'bg-amber-50', color: 'text-amber-700' };
    case 'JOIN_REQUEST_ACCEPTED':
    case 'PARTICIPANT_JOINED':
      return { icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-700' };
    case 'ACTIVITY_INVITE':
      return { icon: PaperPlaneTilt, bg: 'bg-[#ffdad3]/60', color: 'text-[#a93017]' };
    case 'HOST_TRANSFERRED':
      return { icon: Crown, bg: 'bg-amber-50', color: 'text-amber-700' };
    default:
      return { icon: BellRinging, bg: 'bg-[#f0f3ff]', color: 'text-[#14241E]' };
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

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
    setMarkingAll(true);
    try {
      await apiRequest('/traveller/notifications/read-all', { method: 'POST' });
      window.dispatchEvent(new Event('notifications:read-all'));
      await load();
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (n: NotificationItem) => {
    if (!n.readAt) {
      void apiRequest(`/traveller/notifications/${n._id}/read`, { method: 'PATCH' });
    }
    if (n.referenceId) {
      navigate(`/app/activities/${n.referenceId}`);
    }
  };

  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <TravellerLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold text-[#111c2d] tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#14241E] text-emerald-300 text-[11px] font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e0bfb8]/40 text-xs font-bold text-[#a93017] hover:bg-[#f0f3ff] shadow-2xs transition active:scale-95 disabled:opacity-60"
            >
              {markingAll ? (
                <CircleNotch className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Checks weight="bold" className="w-3.5 h-3.5" />
              )}
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <CircleNotch className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-10 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center mx-auto mb-3">
              <BellSlash weight="duotone" className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#111c2d]">All caught up</p>
            <p className="text-xs text-[#59413c] mt-1">
              Invites, join approvals, and activity updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => {
              const style = getNotifStyle(n.type);
              const Icon = style.icon;
              const isUnread = !n.readAt;
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start gap-3 active:scale-[0.99] ${
                    isUnread
                      ? 'bg-white border-[#a93017]/25 shadow-sm'
                      : 'bg-white/75 border-[#e0bfb8]/30 hover:bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}
                  >
                    <Icon weight="duotone" className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#111c2d] truncate">{n.title}</p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#59413c] mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1.5">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>

                  {n.referenceId && (
                    <div className="self-center text-slate-400 shrink-0">
                      <CaretRight weight="bold" className="w-4 h-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
