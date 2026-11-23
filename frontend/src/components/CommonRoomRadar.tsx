import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Broadcast,
  SlidersHorizontal,
  X,
  Sparkle,
  GameController,
  Coffee,
  Headphones,
  HandWaving,
} from '@phosphor-icons/react';
import {
  SOCIAL_STATUS_OPTIONS,
  formatSocialStatus,
  type SocialStatusValue,
} from './SocialStatusWidget';
import { apiRequest } from '../lib/api';

export interface RadarTraveller {
  userId: string;
  nickname: string;
  status: SocialStatusValue | null;
}

const BUBBLE_POSITIONS = [
  'top-2 left-2 animate-float',
  'top-3 right-2 animate-float-alt',
  'bottom-2 left-3 animate-float-alt',
  'bottom-3 right-2 animate-float',
  'top-1/2 -translate-y-1/2 left-1 animate-float',
  'top-1/2 -translate-y-1/2 right-1 animate-float-alt',
];

const VIBE_ICON: Record<SocialStatusValue, typeof Sparkle> = {
  OPEN_TO_MEETING: Sparkle,
  UP_FOR_ACTIVITIES: GameController,
  LOOKING_FOR_COMPANY: Coffee,
  JUST_CHILLING: Headphones,
};

export function CommonRoomRadar({
  hostelName,
  hostelCity,
  travellers,
  currentStatus,
  onStatusUpdated,
}: {
  hostelName: string;
  hostelCity: string;
  travellers: RadarTraveller[];
  currentStatus: SocialStatusValue | null;
  onStatusUpdated: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<SocialStatusValue | null>(currentStatus);
  const [busy, setBusy] = useState(false);

  const displayStatus = busy ? optimistic : (currentStatus ?? optimistic);
  const visible = travellers.slice(0, 6);

  const selectVibe = async (val: SocialStatusValue) => {
    const prev = displayStatus;
    setOptimistic(val);
    setPickerOpen(false);
    setBusy(true);
    try {
      await apiRequest('/traveller/status', {
        method: 'PUT',
        body: JSON.stringify({ status: val }),
      });
      onStatusUpdated();
    } catch {
      setOptimistic(prev);
    } finally {
      setBusy(false);
    }
  };

  const turnOffVibe = async () => {
    const prev = displayStatus;
    setOptimistic(null);
    setPickerOpen(false);
    setBusy(true);
    try {
      await apiRequest('/traveller/status', { method: 'DELETE' });
      onStatusUpdated();
    } catch {
      setOptimistic(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden bg-gradient-to-br from-[#eaf8f3] via-[#f7fbfb] to-[#fdf3ec] border border-emerald-200/70 shadow-sm">
      {/* Subtle atmospheric glow */}
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-6 -bottom-6 w-36 h-36 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Radar Header Row */}
      <div className="flex items-center justify-between relative z-10 mb-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-extrabold tracking-wider text-emerald-700 uppercase">
            Live Hostel Radar
          </span>
        </div>
        <Link
          to="/app/discover"
          className="text-[11px] font-semibold text-emerald-800 bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-200/80 hover:bg-white transition"
        >
          {travellers.length} {travellers.length === 1 ? 'traveller' : 'travellers'} live
        </Link>
      </div>

      {/* Concentric Orbit Zone */}
      <Link
        to="/app/discover"
        className="relative w-full h-[210px] rounded-xl flex items-center justify-center overflow-hidden my-1"
      >
        <div className="absolute w-56 h-56 rounded-full border border-emerald-500/20 pointer-events-none" />
        <div className="absolute w-40 h-40 rounded-full border border-emerald-500/25 pointer-events-none" />
        <div className="absolute w-24 h-24 rounded-full border border-emerald-500/35 border-dashed pointer-events-none" />
        <div className="absolute w-14 h-14 rounded-full bg-emerald-400/20 animate-pulse pointer-events-none" />

        {/* Central Beacon */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-300 p-0.5 shadow-[0_0_24px_rgba(16,185,129,0.45)] flex items-center justify-center">
            <div className="w-full h-full bg-[#14241E] rounded-full flex items-center justify-center">
              <Broadcast weight="duotone" className="w-5 h-5 text-emerald-300" />
            </div>
          </div>
          <span className="text-[11px] font-extrabold text-[#111c2d] mt-1.5">
            {hostelCity || hostelName} Hub
          </span>
          <span className="text-[9px] text-emerald-700 font-semibold">Live Beacon</span>
        </div>

        {/* Floating Real Traveller Bubbles */}
        {visible.map((t, i) => {
          const initials = t.nickname
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const VibeIcon = t.status ? VIBE_ICON[t.status] : HandWaving;
          const isWarm = i % 2 === 1;
          return (
            <div
              key={t.userId}
              className={`absolute ${BUBBLE_POSITIONS[i]} z-20 flex items-center gap-1.5 bg-[#14241E]/85 backdrop-blur-md border ${
                isWarm ? 'border-amber-400/40' : 'border-white/25'
              } pl-1 pr-2.5 py-1 rounded-full shadow-md`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-1 ${
                  isWarm ? 'bg-[#a93017] ring-amber-300' : 'bg-emerald-600 ring-emerald-300'
                }`}
              >
                {initials}
              </span>
              <span
                className={`text-[10px] font-bold tracking-tight max-w-[78px] truncate ${
                  isWarm ? 'text-amber-200' : 'text-white'
                }`}
              >
                {t.nickname}
              </span>
              <VibeIcon
                weight="duotone"
                className={`w-3.5 h-3.5 shrink-0 ${isWarm ? 'text-amber-300' : 'text-emerald-300'}`}
              />
            </div>
          );
        })}
      </Link>

      {/* Bottom Vibe Broadcast Bar */}
      <div className="relative z-10 mt-2 pt-2.5 border-t border-emerald-900/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[11px] text-[#59413c] font-medium truncate">
            Your status:{' '}
            <strong className="text-emerald-700 font-extrabold">
              {displayStatus ? formatSocialStatus(displayStatus) : 'Not set'}
            </strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="bg-emerald-500 hover:bg-emerald-400 text-[#0d1713] text-[11px] font-extrabold px-3 py-1.5 rounded-full transition active:scale-95 flex items-center gap-1 shadow-xs shrink-0"
        >
          <span>{pickerOpen ? 'Close' : 'Change Vibe'}</span>
          {pickerOpen ? (
            <X className="w-3.5 h-3.5" />
          ) : (
            <SlidersHorizontal className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Expandable 4-Option Vibe Picker */}
      {pickerOpen && (
        <div className="relative z-10 mt-3 pt-3 border-t border-emerald-900/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {SOCIAL_STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = displayStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectVibe(opt.value)}
                  className={`text-left p-2.5 rounded-xl border transition flex items-start gap-2 ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50 text-[#111c2d]'
                      : 'border-white/80 bg-white/80 hover:bg-white text-[#59413c]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      selected ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-[11px] font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{opt.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {displayStatus && (
            <button
              type="button"
              onClick={turnOffVibe}
              className="w-full py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Turn off my vibe
            </button>
          )}
        </div>
      )}
    </div>
  );
}
