import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Broadcast,
  UsersThree,
  ChatCircleDots,
  PlusCircle,
  CalendarCheck,
  Bell,
  BellRinging,
  X,
  GearSix,
  MapPin,
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import { enablePushNotifications, getVapidPublicKey, isPushSupported } from '../lib/push';
import { Avatar } from './Avatar';
import { Footer } from './Footer';

export function TravellerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
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
        const [notifRes, chatRes] = await Promise.all([
          apiRequest<{ notifications: Array<{ readAt: string | null }> }>(
            '/traveller/notifications'
          ),
          apiRequest<{ totalUnread?: number }>('/chat/rooms'),
        ]);
        if (active) {
          setUnreadCount(notifRes.notifications.filter((n) => !n.readAt).length);
          setUnreadChats(chatRes.totalUnread ?? 0);
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
    const onChatMsg = (msg?: { senderId?: string }) => {
      if (msg?.senderId && msg.senderId !== user?.id) {
        void loadNotifs();
      }
    };
    const onChatRead = () => void loadNotifs();
    socket.on('notification:new', onNew);
    socket.on('join_request:received', onNew);
    socket.on('join_request:accepted', onNew);
    socket.on('join_request:declined', onNew);
    socket.on('chat:message', onChatMsg);
    window.addEventListener('notifications:read-all', onReadAll);
    window.addEventListener('chat:read', onChatRead);

    return () => {
      active = false;
      socket.off('notification:new', onNew);
      socket.off('join_request:received', onNew);
      socket.off('join_request:accepted', onNew);
      socket.off('join_request:declined', onNew);
      socket.off('chat:message', onChatMsg);
      window.removeEventListener('notifications:read-all', onReadAll);
      window.removeEventListener('chat:read', onChatRead);
    };
  }, [location.pathname, user?.id]);

  const navItems = [
    { to: '/app', label: 'Radar', icon: Broadcast },
    { to: '/app/discover', label: 'People', icon: UsersThree },
    { to: '/app/chat', label: 'Chat', icon: ChatCircleDots },
    { to: '/app/activities/new', label: 'Host', icon: PlusCircle },
    { to: '/app/my-activities', label: 'Plans', icon: CalendarCheck },
  ];

  const initials = (user?.nickname ?? 'CG')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const desktopNavItems = [
    ...navItems,
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings', label: 'Profile & Settings', icon: GearSix },
  ];

  const isActivePath = (to: string) =>
    to === '/app' ? location.pathname === '/app' : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex bg-[#f9f9ff] text-[#111c2d]">
      {/* Desktop Left Dark Emerald Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 sticky top-0 h-screen bg-[#062018] text-white border-r border-emerald-500/15">
        <div className="px-5 pt-6 pb-5 space-y-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-emerald-400/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider text-emerald-100 uppercase">
              goSTOPS
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">✕</span>
            <span className="text-[10px] font-extrabold tracking-tight text-white">
              COMMON GROUND
            </span>
          </Link>

          {user?.hostelName && (
            <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-emerald-200/85 truncate">
              <MapPin weight="fill" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{user.hostelName}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.to);
            const badge =
              item.to === '/app/chat'
                ? unreadChats
                : item.to === '/app/notifications'
                  ? unreadCount
                  : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-[#0e4438] text-white shadow-xs'
                    : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    weight={active ? 'fill' : 'duotone'}
                    className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-emerald-300/70'}`}
                  />
                  <span>{item.label}</span>
                </span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#a93017] text-white text-[10px] font-extrabold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Traveller Profile Pill */}
        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => navigate('/app/settings')}
            className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition"
          >
            <div className="relative shrink-0">
              <Avatar
                src={user?.avatar}
                name={user?.nickname ?? initials}
                className="w-9 h-9 rounded-full"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#062018]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-white truncate">
                {user?.nickname ?? 'Traveller'}
              </p>
              <p className="text-[10px] text-emerald-300/75 truncate">Active 72h session</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Header (hidden on desktop where sidebar handles navigation) */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#f9f9ff]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
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
                className="relative rounded-full ring-2 ring-emerald-500/30 shadow-sm"
                aria-label="Profile & Settings"
                title={user?.nickname}
              >
                <Avatar
                  src={user?.avatar}
                  name={user?.nickname ?? initials}
                  className="w-9 h-9 rounded-full"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-md lg:max-w-4xl w-full mx-auto px-4 lg:px-8 pt-3 lg:pt-6 pb-28 lg:pb-10">
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

        <div className="pb-20 lg:pb-0">
          <Footer />
        </div>
      </div>

      {/* Mobile Floating Pill Bottom Nav (hidden on desktop) */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="bg-[#14241E]/95 backdrop-blur-xl border border-emerald-500/20 text-white rounded-full px-3 py-2 shadow-2xl flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center relative py-1 px-2 transition-all ${
                  active ? 'text-emerald-400' : 'text-emerald-100/65 hover:text-white'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon weight={active ? 'fill' : 'duotone'} className="w-5 h-5" />
                  {item.to === '/app/chat' && unreadChats > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#a93017] text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-[#14241E]">
                      {unreadChats > 9 ? '9+' : unreadChats}
                    </span>
                  ) : active ? (
                    <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ) : null}
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
