import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Lock, Award, Loader2, Stamp } from 'lucide-react';
import { apiRequest } from '../lib/api';

export interface ActivitySummary {
  _id: string;
  title: string;
  description: string;
  category: string;
  creatorType: 'TRAVELLER' | 'HOSTEL_MANAGER';
  creatorNickname: string;
  scheduledAt: string;
  endsAt: string;
  meetingPoint: string;
  maxParticipants: number;
  confirmedCount: number;
  joinMode: 'PUBLIC' | 'APPROVAL';
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';
  isCreator?: boolean;
  isJoined?: boolean;
  hasPendingRequest?: boolean;
}

export function ActivityCard({
  activity,
  onJoined,
}: {
  activity: ActivitySummary;
  onJoined?: () => void;
}) {
  const [joining, setJoining] = useState(false);
  const [quickJoined, setQuickJoined] = useState(false);
  const isOfficial = activity.creatorType === 'HOSTEL_MANAGER';
  const spotsLeft = Math.max(0, activity.maxParticipants - activity.confirmedCount);
  const start = new Date(activity.scheduledAt);
  const timeLabel = start.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleQuickJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setJoining(true);
    try {
      await apiRequest(`/activities/${activity._id}/join`, { method: 'POST' });
      setQuickJoined(true);
      onJoined?.();
    } finally {
      setJoining(false);
    }
  };

  const statusStyles: Record<string, string> = {
    OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FULL: 'bg-amber-50 text-amber-800 border-amber-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
    COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200',
    EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const maxDots = Math.min(activity.maxParticipants, 10);
  const filledDots = Math.min(
    maxDots,
    Math.round((activity.confirmedCount / activity.maxParticipants) * maxDots)
  );

  return (
    <Link
      to={`/app/activities/${activity._id}`}
      className={`block relative bg-white rounded-3xl border transition hover:shadow-md overflow-hidden ${
        isOfficial ? 'border-[#E85D3F]/45 ring-1 ring-[#E85D3F]/10' : 'border-amber-200/80'
      }`}
    >
      <div className="p-4 sm:p-5 pb-3.5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {isOfficial && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[#FFF0EC] text-[#D94E32] border border-[#E85D3F]/25">
                <Award className="w-3 h-3" /> Official Hostel Pass
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900">
              {activity.category}
            </span>
            {activity.joinMode === 'APPROVAL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                <Lock className="w-3 h-3" /> Approval
              </span>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              statusStyles[activity.status] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {activity.status}
          </span>
        </div>

        <h3 className="text-base font-extrabold text-slate-900 mb-1">{activity.title}</h3>
        <p className="text-xs text-slate-600 line-clamp-1 mb-3">{activity.description}</p>

        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#FAF7F2] text-xs text-slate-700 font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <Calendar className="w-3.5 h-3.5 text-[#E85D3F] shrink-0" />
            <span className="truncate">{timeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#E85D3F] shrink-0" />
            <span className="truncate">{activity.meetingPoint}</span>
          </div>
        </div>
      </div>

      {/* Perforated Boarding-Pass Divider */}
      <div className="relative flex items-center">
        <span className="w-3.5 h-3.5 rounded-full bg-[#FAF7F2] border-r border-amber-200/80 -ml-2 shrink-0" />
        <div className="flex-1 border-t border-dashed border-amber-200" />
        <span className="w-3.5 h-3.5 rounded-full bg-[#FAF7F2] border-l border-amber-200/80 -mr-2 shrink-0" />
      </div>

      {/* Boarding Pass Stub */}
      <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 text-xs bg-amber-50/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1" title={`${activity.confirmedCount}/${activity.maxParticipants} seats`}>
            {Array.from({ length: maxDots }).map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx < filledDots ? 'bg-[#E85D3F]' : 'bg-amber-200/80'
                }`}
              />
            ))}
          </div>
          <span className="font-mono font-bold text-slate-700 text-[11px]">
            {activity.confirmedCount}/{activity.maxParticipants}
          </span>
          {activity.status === 'OPEN' && spotsLeft === 1 && (
            <span className="text-[10px] font-bold text-[#E85D3F]">1 left</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activity.isJoined || quickJoined ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
              <Stamp className="w-3 h-3" /> Stamped In
            </span>
          ) : activity.hasPendingRequest ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
              Pending
            </span>
          ) : activity.status === 'OPEN' && activity.joinMode === 'PUBLIC' && onJoined ? (
            <button
              type="button"
              onClick={handleQuickJoin}
              disabled={joining}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E85D3F] hover:bg-[#D94E32] active:scale-95 text-white font-bold text-[11px] uppercase tracking-wide transition disabled:opacity-60"
            >
              {joining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Stamp className="w-3 h-3" />}
              {joining ? 'Stamping...' : 'Stamp Me In'}
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              By {activity.creatorNickname}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
