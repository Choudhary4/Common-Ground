import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Coffee,
  Gamepad2,
  Compass,
  Utensils,
  Sparkles,
  Hand,
} from 'lucide-react';
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

const CATEGORY_ICON: Record<string, typeof Coffee> = {
  SOCIAL: Coffee,
  GAMES: Gamepad2,
  EXPLORATION: Compass,
  FOOD: Utensils,
  OTHER: Sparkles,
};

export function ActivityCard({
  activity,
  onJoined,
}: {
  activity: ActivitySummary;
  onJoined?: () => void;
}) {
  const [joining, setJoining] = useState(false);
  const [quickJoined, setQuickJoined] = useState(false);
  const [requested, setRequested] = useState(false);

  const isOfficial = activity.creatorType === 'HOSTEL_MANAGER';
  const spotsLeft = Math.max(0, activity.maxParticipants - activity.confirmedCount);
  const pct = Math.min(
    100,
    Math.round((activity.confirmedCount / Math.max(1, activity.maxParticipants)) * 100)
  );
  const CatIcon = CATEGORY_ICON[activity.category] ?? Sparkles;

  const start = new Date(activity.scheduledAt);
  const timeLabel = start.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleQuickAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setJoining(true);
    try {
      const res = await apiRequest<{ joined: boolean }>(`/activities/${activity._id}/join`, {
        method: 'POST',
      });
      if (res.joined) setQuickJoined(true);
      else setRequested(true);
      onJoined?.();
    } finally {
      setJoining(false);
    }
  };

  const isJoinedNow = activity.isJoined || quickJoined;
  const isPendingNow = activity.hasPendingRequest || requested;

  return (
    <Link
      to={`/app/activities/${activity._id}`}
      className="block bg-white rounded-2xl p-4 shadow-sm border border-[#e0bfb8]/35 relative overflow-hidden transition hover:shadow-md"
    >
      {isOfficial && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-[#a93017]" />
      )}

      {/* Top Pills */}
      <div className={`flex items-center justify-between gap-2 mb-2.5 ${isOfficial ? 'pt-1' : ''}`}>
        {isOfficial ? (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            OFFICIAL · {activity.meetingPoint}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-[#6fd8c8]/30 text-[#00685d] px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            Traveller Hosted
          </span>
        )}

        <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/70 shrink-0">
          {timeLabel}
        </span>
      </div>

      {/* Title & Host Subtitle */}
      <div className="space-y-1 mb-3">
        <h3 className="text-[20px] font-extrabold text-[#111c2d] leading-snug">{activity.title}</h3>
        <p className="text-xs text-[#59413c] flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-[#111c2d]">
            {isOfficial ? 'Hostel Team Event' : activity.creatorNickname}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-0.5 text-[#a93017] font-semibold">
            <MapPin className="w-3.5 h-3.5" /> {activity.meetingPoint}
          </span>
        </p>
      </div>

      {/* Soft Info Callout Box */}
      <div className="bg-[#f0f3ff] rounded-xl p-3 flex items-center justify-between gap-2.5 mb-3 border border-[#e0bfb8]/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isOfficial ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            <CatIcon className="w-4 h-4" />
          </div>
          <p className="text-xs text-[#59413c] line-clamp-2 leading-relaxed">{activity.description}</p>
        </div>
        {activity.status === 'OPEN' && spotsLeft <= 3 && (
          <span className="bg-[#d8e3fb] text-[#111c2d] text-[10px] font-bold px-2 py-1 rounded-full shrink-0">
            {spotsLeft} {spotsLeft === 1 ? 'seat' : 'seats'} left
          </span>
        )}
      </div>

      {/* Capacity Progress Bar */}
      <div className="space-y-2 mb-3.5">
        <div className="flex items-center justify-between text-[11px] text-[#59413c]">
          <span className="font-semibold uppercase tracking-wide text-[10px] text-slate-500">
            {activity.category} · {activity.joinMode === 'PUBLIC' ? 'Instant Join' : 'Approval'}
          </span>
          <span>
            <strong className="text-[#111c2d] font-extrabold">
              {activity.confirmedCount}/{activity.maxParticipants} joined
            </strong>{' '}
            {activity.status === 'OPEN' ? `(${spotsLeft} left)` : `· ${activity.status}`}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#e7eeff] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOfficial
                ? 'bg-gradient-to-r from-amber-500 to-[#a93017]'
                : 'bg-[#00685d]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Full-Width Pill CTA */}
      {isJoinedNow ? (
        <div className="w-full h-11 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-bold flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          <span>You're in the Circle</span>
        </div>
      ) : isPendingNow ? (
        <div className="w-full h-11 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-sm font-bold flex items-center justify-center">
          Pending Host Approval
        </div>
      ) : activity.status === 'OPEN' && onJoined ? (
        <button
          type="button"
          onClick={handleQuickAction}
          disabled={joining}
          className={`w-full h-11 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 ${
            activity.joinMode === 'PUBLIC'
              ? 'bg-[#a93017] hover:bg-[#cb482c] text-white shadow-sm'
              : 'bg-[#f0f3ff] hover:bg-[#ffdad3]/40 text-[#a93017] border border-[#e0bfb8]/40'
          }`}
        >
          {joining ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : activity.joinMode === 'PUBLIC' ? null : (
            <Hand className="w-4 h-4" />
          )}
          <span>
            {joining
              ? activity.joinMode === 'PUBLIC'
                ? 'Joining...'
                : 'Sending Request...'
              : activity.joinMode === 'PUBLIC'
                ? 'Quick RSVP · Join Circle'
                : 'Request to Join'}
          </span>
          {!joining && activity.joinMode === 'PUBLIC' && <ArrowRight className="w-4 h-4" />}
        </button>
      ) : null}
    </Link>
  );
}
