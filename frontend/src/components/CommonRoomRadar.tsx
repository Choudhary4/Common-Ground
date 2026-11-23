import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';

export interface RadarTraveller {
  userId: string;
  nickname: string;
  status: string | null;
}

const BUBBLE_POSITIONS = [
  'top-4 left-6',
  'top-5 right-7',
  'bottom-5 left-8',
  'bottom-4 right-6',
  'top-1/2 -translate-y-1/2 left-3',
  'top-1/2 -translate-y-1/2 right-3',
];

export function CommonRoomRadar({
  hostelName,
  travellers,
}: {
  hostelName: string;
  travellers: RadarTraveller[];
}) {
  const visible = travellers.slice(0, 6);

  return (
    <Link
      to="/app/discover"
      className="block relative overflow-hidden rounded-3xl bg-[#14241E] text-white p-5 shadow-sm border border-emerald-900/60 group"
    >
      {/* Concentric radar rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
        <div className="w-32 h-32 rounded-full border border-emerald-400/60" />
        <div className="absolute w-52 h-52 rounded-full border border-emerald-400/40" />
        <div className="absolute w-72 h-72 rounded-full border border-emerald-400/20" />
      </div>

      {/* Floating real traveller bubbles */}
      {visible.map((t, i) => {
        const initials = t.nickname
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <div
            key={t.userId}
            className={`hidden sm:flex absolute ${BUBBLE_POSITIONS[i]} items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/15 text-[11px] font-medium`}
          >
            <span className="w-5 h-5 rounded-full bg-[#E85D3F] text-white text-[10px] font-bold flex items-center justify-center">
              {initials}
            </span>
            <span className="max-w-[72px] truncate">{t.nickname}</span>
          </div>
        );
      })}

      {/* Center pulse */}
      <div className="relative z-10 flex flex-col items-center text-center py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2">
          <Radio className="w-3 h-3 animate-pulse" /> Live Lounge Radar
        </span>
        <h2 className="text-base font-extrabold tracking-tight">{hostelName}</h2>
        <p className="text-xs text-emerald-100/80 mt-1">
          {travellers.length === 0
            ? 'You’re first in the lounge — set your vibe below'
            : `${travellers.length} ${travellers.length === 1 ? 'traveller' : 'travellers'} active right now · Tap to view`}
        </p>

        {/* Mobile compact avatar strip */}
        {visible.length > 0 && (
          <div className="flex sm:hidden items-center -space-x-2 mt-3">
            {visible.map((t) => (
              <span
                key={t.userId}
                className="w-7 h-7 rounded-full bg-[#E85D3F] ring-2 ring-[#14241E] text-white text-[10px] font-bold flex items-center justify-center"
              >
                {t.nickname.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
