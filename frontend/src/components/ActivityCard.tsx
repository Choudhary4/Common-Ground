import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Lock, Award, Loader2 } from 'lucide-react';
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

  return (
    <Link
      to={`/app/activities/${activity._id}`}
      className={`block bg-white rounded-2xl border p-4 sm:p-5 transition hover:shadow-md ${
        isOfficial ? 'border-[#E85D3F]/40 ring-1 ring-[#E85D3F]/10' : 'border-amber-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isOfficial && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0EC] text-[#D94E32]">
              <Award className="w-3 h-3" /> Official Hostel Activity
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900">
            {activity.category}
          </span>
          {activity.joinMode === 'APPROVAL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
              <Lock className="w-3 h-3" /> Approval
            </span>
          )}
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            statusStyles[activity.status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {activity.status}
        </span>
      </div>

      <h3 className="text-base font-bold text-slate-900 mb-1">{activity.title}</h3>
      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{activity.description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#E85D3F]" />
          <span>{timeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#E85D3F]" />
          <span className="truncate">{activity.meetingPoint}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2">
        <span className="text-slate-500 truncate">
          By <span className="font-semibold text-slate-800">{activity.creatorNickname}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {activity.isJoined || quickJoined ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              You're in
            </span>
          ) : activity.hasPendingRequest ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
              Pending
            </span>
          ) : activity.status === 'OPEN' && activity.joinMode === 'PUBLIC' && onJoined ? (
            <button
              type="button"
              onClick={handleQuickJoin}
              disabled={joining}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E85D3F] hover:bg-[#D94E32] active:scale-95 text-white font-semibold transition disabled:opacity-60"
            >
              {joining && <Loader2 className="w-3 h-3 animate-spin" />}
              {joining ? 'Joining...' : 'Quick Join'}
            </button>
          ) : null}
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {activity.confirmedCount}/{activity.maxParticipants}
            {activity.status === 'OPEN' && spotsLeft === 1 && (
              <span className="text-[10px] font-bold text-[#E85D3F]">(1 left)</span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
