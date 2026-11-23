import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  CircleNotch,
  MapPin,
  Fire,
  GameController,
  Coffee,
  Compass,
  ForkKnife,
  SquaresFour,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { type SocialStatusValue } from '../components/SocialStatusWidget';
import { ActivityCard, type ActivitySummary } from '../components/ActivityCard';
import { CommonRoomRadar, type RadarTraveller } from '../components/CommonRoomRadar';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

const FILTER_CHIPS = [
  { key: 'all', category: 'ALL', label: 'All Active', icon: SquaresFour },
  { key: 'starting_soon', category: 'ALL', label: 'Happening Soon', icon: Fire },
  { key: 'all', category: 'GAMES', label: 'Games', icon: GameController },
  { key: 'all', category: 'SOCIAL', label: 'Social', icon: Coffee },
  { key: 'all', category: 'EXPLORATION', label: 'Exploration', icon: Compass },
  { key: 'all', category: 'FOOD', label: 'Food', icon: ForkKnife },
];

export function TravellerDashboard() {
  const { user } = useAuth();
  const [statusDoc, setStatusDoc] = useState<{ status: SocialStatusValue; expiresAt: string } | null>(
    null
  );
  const [radarTravellers, setRadarTravellers] = useState<RadarTraveller[]>([]);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [activeChipIdx, setActiveChipIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeChip = FILTER_CHIPS[activeChipIdx];

  const loadData = useCallback(async () => {
    try {
      const [statusRes, discoverRes, actRes] = await Promise.all([
        apiRequest<{ status: { status: SocialStatusValue; expiresAt: string } | null }>(
          '/traveller/status'
        ),
        apiRequest<{ openCount: number; travellers: RadarTraveller[] }>('/traveller/discover'),
        apiRequest<{ activities: ActivitySummary[] }>(
          `/activities?filter=${activeChip.key}&category=${activeChip.category}`
        ),
      ]);
      setStatusDoc(statusRes.status);
      setRadarTravellers(discoverRes.travellers);
      setActivities(actRes.activities);
    } finally {
      setLoading(false);
    }
  }, [activeChip.key, activeChip.category]);

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
      <div className="space-y-4">
        {/* Top Location & Host Micro-Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-xs border border-[#e0bfb8]/35">
            <MapPin weight="fill" className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-[#111c2d]">
              {user?.hostelName ?? 'Your Hostel'}
            </span>
          </div>
          <Link
            to="/app/activities/new"
            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200/70 px-3 py-1.5 rounded-full text-xs font-bold text-amber-900 transition active:scale-95"
          >
            <Plus weight="bold" className="w-3.5 h-3.5 text-[#a93017]" /> Host Plan
          </Link>
        </div>

        {/* Hero: Live Hostel Radar + Inline Vibe Switcher */}
        <CommonRoomRadar
          hostelName={user?.hostelName ?? 'Your Hostel'}
          hostelCity={user?.hostelCity ?? ''}
          travellers={radarTravellers}
          currentStatus={statusDoc?.status ?? null}
          onStatusUpdated={loadData}
        />

        {/* Tactile Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
          {FILTER_CHIPS.map((chip, idx) => {
            const active = activeChipIdx === idx;
            const ChipIcon = chip.icon;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => setActiveChipIdx(idx)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition ${
                  active
                    ? 'bg-[#14241E] text-white shadow-sm'
                    : 'bg-white text-[#59413c] border border-[#e0bfb8]/35 hover:bg-[#f0f3ff] shadow-2xs'
                }`}
              >
                <ChipIcon
                  weight="duotone"
                  className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-[#a93017]'}`}
                />
                <span>{idx === 0 ? `${chip.label} (${activities.length})` : chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-extrabold text-[#111c2d] leading-tight">
              Happening Around goSTOPS
            </h2>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {activities.length} Live
            </span>
          </div>
          {user?.hostelCity && (
            <span className="text-[11px] font-bold text-[#a93017] shrink-0">
              {user.hostelCity} Social
            </span>
          )}
        </div>

        {/* Activity Cards */}
        {loading ? (
          <div className="py-10 flex justify-center text-slate-400">
            <CircleNotch className="w-6 h-6 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-8 text-center shadow-xs">
            <p className="text-sm font-bold text-[#111c2d] mb-1">No matching activities yet</p>
            <p className="text-xs text-[#59413c] mb-4">
              Start something simple—like chai on the rooftop or a quick card game.
            </p>
            <Link
              to="/app/activities/new"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#a93017] text-white text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Host an activity
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {activities.map((a) => (
              <ActivityCard key={a._id} activity={a} onJoined={loadData} />
            ))}
          </div>
        )}
      </div>
    </TravellerLayout>
  );
}
