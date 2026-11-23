import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Users, PlusCircle, CalendarCheck, Bell, Settings, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Footer } from './Footer';

export function TravellerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

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
    const onNew = () => setUnreadCount((c) => c + 1);
    socket.on('notification:new', onNew);
    socket.on('join_request:received', onNew);
    socket.on('join_request:accepted', onNew);
    socket.on('join_request:declined', onNew);

    return () => {
      active = false;
      socket.off('notification:new', onNew);
      socket.off('join_request:received', onNew);
      socket.off('join_request:accepted', onNew);
      socket.off('join_request:declined', onNew);
    };
  }, [location.pathname]);

  const navItems = [
    { to: '/app', label: 'Feed', icon: Compass },
    { to: '/app/discover', label: 'Travellers', icon: Users },
    { to: '/app/activities/new', label: 'Host', icon: PlusCircle },
    { to: '/app/my-activities', label: 'Mine', icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur border-b border-amber-200/70">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#E85D3F] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              CG
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">Common Ground</p>
              {user?.hostelName && (
                <p className="text-[11px] text-[#D94E32] font-medium flex items-center gap-0.5 leading-tight">
                  <MapPin className="w-3 h-3" /> {user.hostelName}
                </p>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/app/notifications')}
              className="relative p-2 rounded-xl hover:bg-amber-100/70 text-slate-700 transition"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E85D3F] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/app/settings')}
              className="p-2 rounded-xl hover:bg-amber-100/70 text-slate-700 transition"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 pb-24">{children}</main>

      <div className="pb-16">
        <Footer />
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-amber-200/80">
        <div className="max-w-2xl mx-auto grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                  active ? 'text-[#E85D3F]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
