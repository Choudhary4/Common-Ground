import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Broadcast,
  UsersThree,
  PlusCircle,
  CalendarCheck,
  Bell,
  BellRinging,
  X,
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import { enablePushNotifications, getVapidPublicKey, isPushSupported } from '../lib/push';
import { Footer } from './Footer';

export function TravellerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkPush() {
      if (!isPushSupported()) return;
      if (Notification.permission === 'granted') {
        // Ensure the current logged-in traveller session is synced to backend push subscriptions
        void enablePushNotifications().catch(() => {});
        return;
      }
      if (Notification.permission !== 'default') return;
      if (localStorage.getItem('cg_push_dismissed') === '1') return;
      const key = await getVapidPublicKey();
      if (active && key) setShowPushPrompt(true);
    }
    void checkPush();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      await enablePushNotifications();
      setShowPushPrompt(false);
    } finally {
      setEnablingPush(false);
    }
  };

  const dismissPush = () => {
    localStorage.setItem('cg_push_dismissed', '1');
    setShowPushPrompt(false);
  };

  useEffect(() => {
    let active = true;
    const loadNotifs = async () => {
      try {
        const res = await apiRequest<{ notifications: Array<{ readAt: string | null }> }>(
          '/traveller/notifications'
        );
        if (active) {
          setUnreadCount(res.notifications.filter((n) => !n.readAt).length);
        }
      } catch {
        // ignore
      }
    };
    void loadNotifs();

    const socket = getSocket();
    const showLocalAlert = (payload?: { title?: string; message?: string; _id?: string; notification?: { title?: string; message?: string; _id?: string } }) => {
      const n = payload?.notification ?? payload;
      if (!isPushSupported() || Notification.permission !== 'granted' || !n?.title) return;
      void navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification(n.title!, {
            body: n.message ?? '',
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: n._id ?? 'common-ground',
          })
        )
        .catch(() => {});
    };
    const onNew = (payload?: unknown) => {
      setUnreadCount((c) => c + 1);
      showLocalAlert(payload as Parameters<typeof showLocalAlert>[0]);
    };
    const onReadAll = () => setUnreadCount(0);
    socket.on('notification:new', onNew);
    socket.on('join_request:received', onNew);
    socket.on('join_request:accepted', onNew);
    socket.on('join_request:declined', onNew);
    window.addEventListener('notifications:read-all', onReadAll);

    return () => {
      active = false;
      socket.off('notification:new', onNew);
      socket.off('join_request:received', onNew);
      socket.off('join_request:accepted', onNew);
      socket.off('join_request:declined', onNew);
      window.removeEventListener('notifications:read-all', onReadAll);
    };
  }, [location.pathname]);

  const navItems = [
    { to: '/app', label: 'Radar', icon: Broadcast },
    { to: '/app/discover', label: 'Travellers', icon: UsersThree },
    { to: '/app/activities/new', label: 'Host', icon: PlusCircle },
    { to: '/app/my-activities', label: 'My Plans', icon: CalendarCheck },
  ];

  const initials = (user?.nickname ?? 'CG')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      <header className="sticky top-0 z-40 bg-[#f9f9ff]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/app"
            className="h-9 px-3 bg-[#14241E] rounded-full flex items-center gap-2 shadow-sm border border-emerald-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider text-emerald-100 uppercase">
              goSTOPS
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">✕</span>
            <span className="text-[11px] font-extrabold tracking-tight text-white">
              COMMON GROUND
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/app/notifications')}
              className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#f0f3ff] hover:bg-[#e7eeff] transition-colors text-[#111c2d] border border-[#e0bfb8]/40"
              aria-label="Notifications"
            >
              <Bell weight="duotone" className="w-[20px] h-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#a93017] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/app/settings')}
              className="relative w-9 h-9 rounded-full bg-[#14241E] text-emerald-100 font-bold text-xs flex items-center justify-center ring-2 ring-emerald-500/30 shadow-sm"
              aria-label="Profile & Settings"
              title={user?.nickname}
            >
              {initials}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-3 pb-28">
        {showPushPrompt && (
          <div className="mb-3 p-3 rounded-2xl bg-white border border-[#e0bfb8]/40 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <BellRinging weight="duotone" className="w-4 h-4 text-[#a93017] shrink-0" />
              <p className="text-[11px] text-[#59413c]">
                <strong className="text-[#111c2d]">Mobile alerts</strong> for invites &amp; joins
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleEnablePush}
                disabled={enablingPush}
                className="px-2.5 py-1 rounded-full bg-[#a93017] text-white text-[11px] font-bold disabled:opacity-60"
              >
                {enablingPush ? '...' : 'Enable'}
              </button>
              <button
                onClick={dismissPush}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {children}
      </main>

      <div className="pb-20">
        <Footer />
      </div>

      <nav className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="bg-[#14241E]/95 backdrop-blur-xl border border-emerald-500/20 text-white rounded-full px-3 py-2 shadow-2xl flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center relative py-1 px-3 transition-all ${
                  active ? 'text-emerald-400' : 'text-emerald-100/65 hover:text-white'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon weight={active ? 'fill' : 'duotone'} className="w-5 h-5" />
                  {active && (
                    <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
